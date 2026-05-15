import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	AlertTriangle,
	CalendarClock,
	ChevronDown,
	ChevronUp,
	Hourglass,
	Loader2,
	X,
} from "lucide-react";
import { Joyride, STATUS, type Step, type EventData } from "react-joyride";
import { useTheme } from "@/hooks/useTheme";
import "./ConflictModal.css";

export interface ConflictInfo {
	activityTitle: string;
	date: string;
	totalHours: number;
	maxHours: number;
}

export interface ConflictModalSubtask {
	id: number;
	activityId?: number;
	name: string;
	activityTitle: string;
	estimatedHours: number;
	targetDate?: string;
	courseName?: string;
}

export interface ConflictModalItem {
	id: number;
	date: string;
	plannedHours: number;
	maxHours: number;
	title: string;
	subtitle: string;
	subtasks: ConflictModalSubtask[];
}

interface ConflictModalProps {
	conflicts: ConflictModalItem[];
	onClose: () => void;
	dateLoadMap?: Record<string, number>;
	maxDailyHours?: number;
	hasSeenConflictTour?: boolean;
	onConflictTourComplete?: () => void;
	onChangeDate?: (payload: {
		conflict: ConflictModalItem;
		subtask: ConflictModalSubtask;
		nextDate: string;
	}) => Promise<void> | void;
	onReduceHours?: (payload: {
		conflict: ConflictModalItem;
		subtask: ConflictModalSubtask;
		nextHours: number;
	}) => Promise<void> | void;
}

type ResolverState = {
	mode: "date" | "hours";
	conflict: ConflictModalItem;
	subtask: ConflictModalSubtask;
	value: string;
};

function parseDate(date: string): Date | null {
	const parsed = new Date(`${date}T00:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function getSearchStartDate(startDate: string, minDate: string): Date {
	const parsedStart = parseDate(startDate);
	const parsedMin = parseDate(minDate) ?? new Date();
	if (!parsedStart || parsedStart < parsedMin) return parsedMin;
	return parsedStart;
}

function getNextConflictFreeDate(
	startDate: string,
	conflictDates: string[],
	minDate: string,
): string | null {
	const from = getSearchStartDate(startDate, minDate);
	const blocked = new Set(conflictDates);

	for (let offset = 0; offset <= 90; offset += 1) {
		const candidate = toIsoDate(addDays(from, offset));
		if (!blocked.has(candidate)) return candidate;
	}

	return null;
}

function getNextCapacitySafeDate(params: {
	startDate: string;
	minDate: string;
	currentDate: string;
	movingHours: number;
	dateLoadMap: Record<string, number>;
	maxDailyHours: number;
	blockedDates: string[];
}): string | null {
	const { startDate, minDate, currentDate, movingHours, dateLoadMap, maxDailyHours, blockedDates } =
		params;
	if (!Number.isFinite(maxDailyHours) || maxDailyHours <= 0) return null;

	const from = getSearchStartDate(startDate, minDate);
	const safeMovingHours = Math.max(0, movingHours || 0);
	const blocked = new Set(blockedDates);

	for (let offset = 0; offset <= 120; offset += 1) {
		const candidate = toIsoDate(addDays(from, offset));
		if (blocked.has(candidate)) continue;
		let candidateLoad = dateLoadMap[candidate] ?? 0;

		if (candidate === currentDate) {
			candidateLoad = Math.max(0, candidateLoad - safeMovingHours);
		}

		if (candidateLoad + safeMovingHours <= maxDailyHours) {
			return candidate;
		}
	}

	return null;
}

function getNextFutureIdleDate(params: {
	startDate: string;
	minDate: string;
	currentDate: string;
	movingHours: number;
	dateLoadMap: Record<string, number>;
	maxDailyHours: number;
	conflictDates: string[];
}): string | null {
	const {
		startDate,
		minDate,
		currentDate,
		movingHours,
		dateLoadMap,
		maxDailyHours,
		conflictDates,
	} = params;

	const safeMovingHours = Math.max(0, movingHours || 0);
	if (Number.isFinite(maxDailyHours) && maxDailyHours > 0 && safeMovingHours > maxDailyHours) {
		return null;
	}

	const from = getSearchStartDate(startDate, minDate);
	const blocked = new Set(conflictDates);

	for (let offset = 0; offset <= 180; offset += 1) {
		const candidate = toIsoDate(addDays(from, offset));
		if (candidate === currentDate) continue;
		if (blocked.has(candidate)) continue;

		const candidateLoad = Math.max(0, dateLoadMap[candidate] ?? 0);
		if (candidateLoad > 0) continue;
		if (maxDailyHours > 0 && candidateLoad + safeMovingHours > maxDailyHours) continue;

		return candidate;
	}

	return null;
}

function normalizeHourValue(value: number): number {
	return Math.max(0, Math.round(value * 4) / 4);
}

function formatConflictDate(date: string): string {
	const parsed = new Date(`${date}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return date;
	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(parsed);
}

export default function ConflictModal({
	conflicts,
	onClose,
	dateLoadMap = {},
	maxDailyHours = 0,
	hasSeenConflictTour = false,
	onConflictTourComplete,
	onChangeDate,
	onReduceHours,
}: ConflictModalProps) {
	const { isDark } = useTheme();
	const [expandedId, setExpandedId] = useState<number | null>(conflicts[0]?.id ?? null);
	const [isClosing, setIsClosing] = useState(false);
	const [resolver, setResolver] = useState<ResolverState | null>(null);
	const [resolverSaving, setResolverSaving] = useState(false);
	const [resolverError, setResolverError] = useState<string | null>(null);
	const closeTimerRef = useRef<number | null>(null);
	const [conflictTourRun, setConflictTourRun] = useState(() => hasSeenConflictTour === false);

	const conflictTourSteps: Step[] = [
		{
			target: '[data-testid="conflict-modal"]',
			content: (
				<div>
					<h3>¡Tienes un conflicto de carga! ⚠️</h3>
					<p>
						Esto ocurre cuando programas más horas de las que puedes estudiar en un día. Aquí puedes
						resolverlos subtarea por subtarea.
					</p>
				</div>
			),
			placement: "left",
			skipBeacon: true,
		},
		{
			target: '[data-testid^="conflict-item-toggle-btn-"]',
			content: 'Haz clic en "Resolver" para ver las subtareas que generan la sobrecarga.',
			placement: "left",
		},
		{
			target: '[data-testid^="conflict-subtask-change-date-btn-"]',
			content: "Puedes mover la subtarea a un día más liviano con un solo clic.",
			placement: "left",
		},
		{
			target: '[data-testid^="conflict-subtask-adjust-hours-btn-"]',
			content: "O reducir las horas estimadas para que quepan en tu límite diario.",
			placement: "left",
		},
	];

	const handleConflictTourCallback = (data: EventData) => {
		const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
		if (finishedStatuses.includes(data.status)) {
			setConflictTourRun(false);
			onConflictTourComplete?.();
		}
	};

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	const requestClose = useCallback(() => {
		if (isClosing) return;
		setIsClosing(true);
		closeTimerRef.current = window.setTimeout(() => {
			onClose();
		}, 220);
	}, [isClosing, onClose]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (resolver) {
					setResolver(null);
					setResolverError(null);
					return;
				}
				requestClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [requestClose, resolver]);

	const openResolver = useCallback(
		(mode: "date" | "hours", conflict: ConflictModalItem, subtask: ConflictModalSubtask) => {
			setResolverError(null);
			setResolver({
				mode,
				conflict,
				subtask,
				value:
					mode === "date"
						? (subtask.targetDate ?? conflict.date)
						: String(subtask.estimatedHours ?? ""),
			});
		},
		[],
	);

	const saveResolver = useCallback(async () => {
		if (!resolver) return;
		setResolverError(null);

		if (resolver.mode === "date") {
			const nextDate = resolver.value.trim();
			if (!nextDate) {
				setResolverError("Selecciona una fecha valida.");
				return;
			}

			if (!onChangeDate) {
				requestClose();
				return;
			}

			try {
				setResolverSaving(true);
				await onChangeDate({
					conflict: resolver.conflict,
					subtask: resolver.subtask,
					nextDate,
				});
				setResolver(null);
			} catch {
				setResolverError("No se pudo actualizar la fecha. Intenta de nuevo.");
			} finally {
				setResolverSaving(false);
			}
			return;
		}

		const parsed = Number(resolver.value);
		if (!Number.isFinite(parsed) || parsed < 1) {
			setResolverError("Ingresa horas validas (1 o mas).");
			return;
		}

		if (!onReduceHours) {
			requestClose();
			return;
		}

		try {
			setResolverSaving(true);
			await onReduceHours({
				conflict: resolver.conflict,
				subtask: resolver.subtask,
				nextHours: parsed,
			});
			setResolver(null);
		} catch {
			setResolverError("No se pudieron actualizar las horas. Intenta de nuevo.");
		} finally {
			setResolverSaving(false);
		}
	}, [onChangeDate, onReduceHours, requestClose, resolver]);

	const todayIso = toIsoDate(new Date());
	const tomorrowIso = toIsoDate(addDays(new Date(), 1));

	const suggestedDateCandidate =
		resolver?.mode === "date"
			? (() => {
					const searchFrom = resolver.value || resolver.conflict.date;
					const currentDate = resolver.subtask.targetDate ?? resolver.conflict.date;
					const conflictDates = conflicts.map((item) => item.date);
					const isOverdueConflict = resolver.conflict.date < todayIso;

					if (isOverdueConflict) {
						return getNextFutureIdleDate({
							startDate: searchFrom,
							minDate: tomorrowIso,
							currentDate,
							movingHours: resolver.subtask.estimatedHours,
							dateLoadMap,
							maxDailyHours,
							conflictDates,
						});
					}

					return (
						getNextCapacitySafeDate({
							startDate: searchFrom,
							minDate: todayIso,
							currentDate,
							movingHours: resolver.subtask.estimatedHours,
							dateLoadMap,
							maxDailyHours,
							blockedDates: conflictDates,
						}) ?? getNextConflictFreeDate(searchFrom, conflictDates, todayIso)
					);
				})()
			: null;

	const suggestedDate =
		resolver?.mode === "date" && suggestedDateCandidate && suggestedDateCandidate !== resolver.value
			? suggestedDateCandidate
			: null;

	const suggestedHours =
		resolver?.mode === "hours"
			? (() => {
					const currentHours = Number(resolver.subtask.estimatedHours) || 0;
					if (currentHours <= 1) return null;

					const overloadHours = Math.max(
						resolver.conflict.plannedHours - resolver.conflict.maxHours,
						0,
					);
					const reduced = normalizeHourValue(currentHours - overloadHours);
					const bounded = Math.max(1, reduced);

					if (!Number.isFinite(bounded) || bounded >= currentHours) return null;
					return bounded;
				})()
			: null;

	const suggestedHoursLabel =
		typeof suggestedHours === "number"
			? Number.isInteger(suggestedHours)
				? String(suggestedHours)
				: suggestedHours.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
			: "";

	const resolverMicrocopy = (() => {
		if (!resolver) return "";
		const { name: subtaskName, estimatedHours: estHours } = resolver.subtask;

		if (maxDailyHours > 0 && estHours > maxDailyHours) {
			if (estHours >= maxDailyHours + maxDailyHours / 2) {
				return `"${subtaskName}" tiene ${estHours} h estimadas en un solo bloque. No cabe en ningún día disponible con tu límite actual. Considera dividirla en partes más pequeñas.`;
			} else {
				return `"${subtaskName}" tiene ${estHours} h estimadas. Es más larga que tu límite diario (${maxDailyHours} h). ¿Quieres dividirla o ajustar el límite solo para ese día?`;
			}
		}

		return resolver.mode === "date"
			? "Tip: moverla a un dia libre suele resolver mas rapido."
			: "Tip: bajar horas ayuda sin mover tu calendario.";
	})();

	// En lugar de no renderizar nada, mostraremos un empty state si no hay conflictos.
	return createPortal(
		<div
			className={`cf-layer ${isClosing ? "is-closing" : ""}`}
			aria-live="polite"
			data-testid="conflict-modal-layer"
		>
			<div className="cf-backdrop" onClick={requestClose} data-testid="conflict-modal-backdrop" />
			<section
				className="cf-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="cf-modal-title"
				data-testid="conflict-modal"
				onClick={(event) => event.stopPropagation()}
			>
				<button
					className="cf-close"
					onClick={requestClose}
					aria-label="Cerrar modal de conflictos"
					data-testid="conflict-modal-close-btn"
				>
					<X size={16} />
				</button>

				<header className="cf-header">
					<div className="cf-header-left">
						<div className="cf-header-icon" aria-hidden="true">
							<AlertTriangle size={22} />
						</div>
						<div className="cf-header-text">
							<h2 id="cf-modal-title">Conflictos detectados</h2>
							<p>
								Detectamos sobrecarga de horas. Elige una accion por subtarea para liberar ese dia.
							</p>
						</div>
					</div>
				</header>

				<div className="cf-content">
					{conflicts.length === 0 ? (
						<div
							style={{
								padding: "4rem 2rem",
								textAlign: "center",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								color: "#8896c8",
							}}
						>
							<div
								style={{
									width: "60px",
									height: "60px",
									borderRadius: "16px",
									background: "rgba(245, 158, 11, 0.08)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									marginBottom: "1rem",
								}}
							>
								<AlertTriangle size={28} color="#fbbf24" style={{ opacity: 0.8 }} />
							</div>
							<h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", color: "#e8ecff" }}>
								Todo está en orden
							</h3>
							<p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.56)" }}>
								Todo está en orden. No hay sobrecargas ni fechas en riesgo.
							</p>
						</div>
					) : (
						conflicts.map((conflict) => {
							const isExpanded = expandedId === conflict.id;

							return (
								<article
									key={conflict.id}
									className={`cf-item ${isExpanded ? "is-expanded" : ""}`}
									data-testid={`conflict-item-${conflict.id}`}
								>
									<div className="cf-item-summary">
										<div className="cf-title-wrap">
											<h3>{conflict.title}</h3>
											<p>{conflict.subtitle}</p>
										</div>

										<div className="cf-meta-block">
											<span className="cf-meta-label">Fecha</span>
											<span className="cf-meta-value">{formatConflictDate(conflict.date)}</span>
										</div>

										<div className="cf-meta-block">
											<span className="cf-meta-label">Carga ese dia</span>
											<span className="cf-hours-value">
												{conflict.plannedHours}h / {conflict.maxHours}h max
											</span>
										</div>

										<button
											type="button"
											className="cf-toggle"
											onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
											data-testid={`conflict-item-toggle-btn-${conflict.id}`}
										>
											{isExpanded ? "Ocultar" : "Resolver"}
											{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
										</button>
									</div>

									<div
										className={`cf-item-details-shell ${isExpanded ? "is-open" : ""}`}
										aria-hidden={!isExpanded}
									>
										<div className="cf-item-details">
											<div className="cf-detail-head">
												<CalendarClock size={14} />
												<span>Resuelve por subtarea</span>
											</div>

											{conflict.subtasks.length ? (
												<div className="cf-subtasks">
													{conflict.subtasks.map((subtask) => (
														<div
															key={subtask.id}
															className="cf-subtask-row"
															data-testid={`conflict-subtask-row-${subtask.id}`}
														>
															<div className="cf-subtask-main">
																<div className="cf-subtask-name">{subtask.name}</div>
																<div className="cf-subtask-meta">
																	{subtask.activityTitle}
																	{subtask.courseName ? ` · ${subtask.courseName}` : ""}
																</div>
															</div>
															<div className="cf-subtask-hours">
																<Hourglass size={14} />
																{subtask.estimatedHours}h
															</div>
															<div className="cf-subtask-actions">
																<button
																	type="button"
																	className="cf-solution-btn is-primary"
																	onClick={() => {
																		openResolver("date", conflict, subtask);
																	}}
																	data-testid={`conflict-subtask-change-date-btn-${subtask.id}`}
																>
																	<span>Cambiar fecha</span>
																	<em>Mover a un dia mas liviano</em>
																</button>
																<button
																	type="button"
																	className="cf-solution-btn"
																	onClick={() => {
																		openResolver("hours", conflict, subtask);
																	}}
																	data-testid={`conflict-subtask-adjust-hours-btn-${subtask.id}`}
																>
																	<span>Ajustar horas</span>
																	<em>Reducir carga de esta subtarea</em>
																</button>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="cf-empty-detail">
													No se encontraron subtareas detalladas para esta fecha, pero el backend
													reporta una sobrecarga activa.
												</div>
											)}

											<button
												type="button"
												className="cf-link"
												onClick={() => setExpandedId(null)}
												data-testid={`conflict-item-close-btn-${conflict.id}`}
											>
												Ver despues
											</button>
										</div>
									</div>
								</article>
							);
						})
					)}
				</div>

				<footer className="cf-footer">
					<div className="cf-footer-status">Puedes resolver ahora o volver luego.</div>
				</footer>

				{resolver && (
					<div
						className="cf-resolver-layer"
						onClick={() => !resolverSaving && setResolver(null)}
						data-testid="conflict-resolver-layer"
					>
						<div
							className="cf-resolver-card"
							onClick={(event) => event.stopPropagation()}
							data-testid="conflict-resolver-card"
						>
							<h3>
								{resolver.mode === "date"
									? "Cambiar fecha de subtarea"
									: "Reducir horas de subtarea"}
							</h3>
							<p>
								<strong>{resolver.subtask.name}</strong> · {resolver.subtask.activityTitle}
							</p>
							<div
								className="cf-resolver-microcopy"
								role="note"
								data-testid="conflict-resolver-note"
							>
								{resolverMicrocopy}
							</div>

							<label className="cf-resolver-label">
								{resolver.mode === "date" ? "Nueva fecha" : "Horas estimadas"}
							</label>
							{resolver.mode === "date" ? (
								<input
									type="date"
									className="cf-resolver-input"
									value={resolver.value}
									onChange={(event) =>
										setResolver((prev) => (prev ? { ...prev, value: event.target.value } : prev))
									}
									disabled={resolverSaving}
									data-testid="conflict-resolver-date-input"
								/>
							) : (
								<input
									type="number"
									min="1"
									step="0.25"
									className="cf-resolver-input"
									value={resolver.value}
									onChange={(event) =>
										setResolver((prev) => (prev ? { ...prev, value: event.target.value } : prev))
									}
									disabled={resolverSaving}
									data-testid="conflict-resolver-hours-input"
								/>
							)}

							{resolver.mode === "date" && suggestedDate && (
								<div className="cf-resolver-suggestions">
									<button
										type="button"
										className="cf-resolver-chip"
										onClick={() =>
											setResolver((prev) =>
												prev && prev.mode === "date" ? { ...prev, value: suggestedDate } : prev,
											)
										}
										disabled={resolverSaving}
										data-testid="conflict-resolver-suggest-date-btn"
									>
										Sugerido: {formatConflictDate(suggestedDate)}
									</button>
								</div>
							)}

							{resolver.mode === "hours" && typeof suggestedHours === "number" && (
								<div className="cf-resolver-suggestions">
									<button
										type="button"
										className="cf-resolver-chip"
										onClick={() =>
											setResolver((prev) =>
												prev && prev.mode === "hours"
													? { ...prev, value: String(suggestedHours) }
													: prev,
											)
										}
										disabled={resolverSaving}
										data-testid="conflict-resolver-suggest-hours-btn"
									>
										Sugerido: {suggestedHoursLabel}h
									</button>
								</div>
							)}

							{resolverError && <div className="cf-resolver-error">{resolverError}</div>}

							<div className="cf-resolver-actions">
								<button
									type="button"
									className="cf-resolver-btn"
									onClick={() => setResolver(null)}
									disabled={resolverSaving}
									data-testid="conflict-resolver-cancel-btn"
								>
									Cancelar
								</button>
								<button
									type="button"
									className="cf-resolver-btn is-confirm"
									onClick={() => void saveResolver()}
									disabled={resolverSaving}
									data-testid="conflict-resolver-save-btn"
								>
									{resolverSaving ? <Loader2 size={14} className="cf-spin" /> : null}
									{resolver.mode === "date" ? "Guardar fecha" : "Guardar horas"}
								</button>
							</div>
						</div>
					</div>
				)}
			</section>
			<Joyride
				onEvent={handleConflictTourCallback}
				continuous
				run={conflictTourRun}
				scrollToFirstStep
				steps={conflictTourSteps}
				options={{
					arrowColor: isDark ? "#1f1c2e" : "#ffffff",
					backgroundColor: isDark ? "#1f1c2e" : "#ffffff",
					overlayColor: "transparent",
					primaryColor: "#ef4444",
					textColor: isDark ? "#f1f5f9" : "#1e1a33",
					zIndex: 20000,
				}}
				styles={{
					tooltipContainer: { textAlign: "left" },
					buttonPrimary: {
						backgroundColor: "#ef4444",
						borderRadius: "6px",
						fontWeight: 600,
						padding: "8px 16px",
					},
					buttonBack: { color: isDark ? "#94a3b8" : "#64748b", marginRight: "10px" },
					buttonSkip: { color: isDark ? "#94a3b8" : "#64748b" },
				}}
				locale={{
					back: "Anterior",
					close: "Cerrar",
					last: "Finalizar",
					next: "Siguiente",
					skip: "Omitir",
				}}
			/>
		</div>,
		document.body,
	);
}
