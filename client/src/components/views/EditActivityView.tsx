import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, ArrowLeft, Loader2, CheckCircle2, CalendarDays, AlertCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { type Activity } from "@/api/dashboard";
import "./EditActivityView.css";

/* ---- Types ---- */
export interface EditActivityViewProps {
	activities: Activity[];
	subjects: string[];
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	onSave: (
		id: number,
		payload: Partial<
			Pick<Activity, "title" | "description" | "due_date" | "status" | "course_name">
		>,
	) => Promise<void>;
}

/* ---- Helpers ---- */
function formatHours(value: number): string {
	if (!Number.isFinite(value)) return "0";
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

function formatDate(iso: string): string {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

/* ---- Inline field error ---- */
function FieldError({ msg }: { msg: string }) {
	return (
		<span className="eav-field-error">
			<AlertCircle size={12} />
			{msg}
		</span>
	);
}

/* ============================================================
   MAIN VIEW COMPONENT
   ============================================================ */
export default function EditActivityView({
	activities,
	subjects,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	onSave,
}: EditActivityViewProps) {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { isDark } = useTheme();
	const activityId = Number(id);

	/* Find the activity in the local list */
	const activity = useMemo(
		() => activities.find((a) => a.id === activityId) ?? null,
		[activities, activityId],
	);

	/* Form state — initialized from the activity */
	const [title, setTitle] = useState(activity?.title ?? "");
	const [description, setDescription] = useState(activity?.description ?? "");
	const [dueDate, setDueDate] = useState(activity?.due_date ?? "");
	const [status, setStatus] = useState<Activity["status"]>(activity?.status ?? "pending");
	const [courseName, setCourseName] = useState(activity?.course_name ?? "");

	/* Update form state when activity is asynchronously loaded/changed */
	useEffect(() => {
		if (activity) {
			const init = () => {
				setTitle(activity.title ?? "");
				setDescription(activity.description ?? "");
				setDueDate(activity.due_date ?? "");
				setStatus(activity.status ?? "pending");
				setCourseName(activity.course_name ?? "");
			};
			init();
		}
	}, [activity]);

	/* Validation & saving */
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	/* Derived */
	const titleError = !title.trim() ? "El título es obligatorio" : "";
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const selectedDateLoad = dueDate ? (dateLoadMap[dueDate] ?? 0) : 0;
	const dueDateHasConflict =
		!!dueDate &&
		(conflictDateSet.has(dueDate) || (maxDailyHours > 0 && selectedDateLoad > maxDailyHours));
	const dueDateCapacityPercent =
		maxDailyHours > 0 ? Math.min((selectedDateLoad / maxDailyHours) * 100, 100) : 0;

	/* Navigation */
	function handleGoBack() {
		navigate(-1);
	}

	/* Submit */
	async function handleSubmit() {
		setSubmitted(true);
		if (titleError) return;
		if (!activity) return;

		setSaving(true);
		setError("");
		try {
			await onSave(activity.id, {
				title: title.trim(),
				description: description.trim(),
				due_date: dueDate,
				status,
				course_name: courseName,
			});
			navigate(`/actividad/${activity.id}`);
		} catch {
			setError("Error al guardar. Intenta de nuevo.");
			setSaving(false);
		}
	}

	/* ---- Not found state ---- */
	if (!activity) {
		return (
			<div
				className="eav-container fade-in"
				data-testid="edit-activity-not-found"
				style={{ animationDelay: "0.2s" }}
			>
				<div className="eav-card">
					<div className="eav-header">
						<div className="eav-header-left">
							<div className="eav-header-icon">
								<AlertCircle size={20} />
							</div>
							<div className="eav-header-text">
								<h3>Actividad no encontrada</h3>
								<p className="eav-header-subtitle">No se encontró una actividad con ID {id}</p>
							</div>
						</div>
						<button
							className="eav-back-btn"
							onClick={() => navigate("/organizacion")}
							data-testid="edit-activity-back-not-found-btn"
						>
							<ArrowLeft size={15} />
							Volver a organización
						</button>
					</div>
				</div>
			</div>
		);
	}

	/* ---- Status config ---- */
	const statusOptions: { value: Activity["status"]; label: string }[] = [
		{ value: "pending", label: "Pendiente" },
		{ value: "in_progress", label: "En progreso" },
		{ value: "completed", label: "Completado" },
	];

	/* Label styles */
	const labelStyle: React.CSSProperties = {
		fontSize: "10.5px",
		fontWeight: 700,
		letterSpacing: "0.8px",
		textTransform: "uppercase",
		color: isDark ? "rgba(255,255,255,0.22)" : "#9b8eb8",
	};

	const fieldStyle: React.CSSProperties = {
		fontFamily: "inherit",
		background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
		border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(124,92,255,0.22)"}`,
		borderRadius: "12px",
		padding: "11px 14px",
		color: isDark ? "rgba(255,255,255,0.9)" : "#1e1a33",
		fontSize: "14px",
		outline: "none",
		width: "100%",
		boxSizing: "border-box" as const,
		transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
	};

	return (
		<div
			className="eav-container fade-in"
			data-testid="edit-activity-view"
			style={{ animationDelay: "0.2s" }}
		>
			<div className="eav-card">
				{/* ====== HEADER ====== */}
				<div className="eav-header">
					<div className="eav-header-left">
						<div className="eav-header-icon">
							<Pencil size={20} />
						</div>
						<div className="eav-header-text">
							<h3>Editar actividad</h3>
							<p className="eav-header-subtitle">{activity.title}</p>
						</div>
					</div>
					<button
						className="eav-back-btn"
						onClick={handleGoBack}
						data-testid="edit-activity-back-nav-btn"
					>
						<ArrowLeft size={15} />
						Volver
					</button>
				</div>

				{/* ====== FORM BODY ====== */}
				<div className="eav-body">
					{error && (
						<div className="eav-error-banner" data-testid="edit-activity-error">
							<AlertCircle size={14} />
							{error}
						</div>
					)}

					{/* Title */}
					<div className="eav-field">
						<label
							htmlFor="eav-title"
							style={{
								...labelStyle,
								...(submitted && titleError ? { color: "rgba(248,113,113,0.8)" } : {}),
							}}
						>
							Título {submitted && titleError ? "·" : "*"}
						</label>
						<input
							id="eav-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="¿Qué vas a hacer?"
							style={{
								...fieldStyle,
								...(submitted && titleError
									? {
											borderColor: "rgba(248,113,113,0.45)",
											backgroundColor: "rgba(248,113,113,0.04)",
											boxShadow: "0 0 0 3px rgba(248,113,113,0.08)",
										}
									: {}),
							}}
							data-testid="edit-activity-title-input"
						/>
						{submitted && titleError && <FieldError msg={titleError} />}
					</div>

					{/* Description */}
					<div className="eav-field">
						<label htmlFor="eav-desc" style={labelStyle}>
							Descripción
						</label>
						<textarea
							id="eav-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Añade contexto o notas relevantes..."
							rows={4}
							style={{
								...fieldStyle,
								resize: "vertical" as const,
								minHeight: "90px",
								lineHeight: 1.6,
							}}
							data-testid="edit-activity-description-input"
						/>
					</div>

					{/* Due date + Status row */}
					<div className="eav-row-split">
						<div className="eav-field">
							<label htmlFor="eav-due-date" style={labelStyle}>
								Fecha de entrega
							</label>
							<div className="eav-date-wrapper">
								<span className="eav-date-icon">
									<CalendarDays size={15} />
								</span>
								<input
									id="eav-due-date"
									type="date"
									value={dueDate}
									onChange={(e) => setDueDate(e.target.value)}
									data-testid="edit-activity-due-date-input"
								/>
							</div>
							{dueDate && (
								<div
									className="eav-capacity-card"
									style={{
										borderColor: dueDateHasConflict
											? "rgba(248,113,113,0.35)"
											: isDark
												? "rgba(124,92,255,0.2)"
												: "rgba(124,92,255,0.2)",
										background: dueDateHasConflict
											? "rgba(248,113,113,0.08)"
											: isDark
												? "rgba(124,92,255,0.08)"
												: "rgba(124,92,255,0.07)",
									}}
								>
									<div className="eav-capacity-header">
										<span>Capacidad para {formatDate(dueDate)}</span>
										<strong
											style={{
												color: dueDateHasConflict ? "#fca5a5" : isDark ? "#c4b5fd" : "#7c3aed",
											}}
										>
											{maxDailyHours > 0
												? `${formatHours(selectedDateLoad)}h / ${formatHours(maxDailyHours)}h`
												: `${formatHours(selectedDateLoad)}h`}
										</strong>
									</div>
									{maxDailyHours > 0 && (
										<div className="eav-capacity-bar">
											<div
												className="eav-capacity-fill"
												style={{
													width: `${dueDateCapacityPercent}%`,
													background: dueDateHasConflict
														? "linear-gradient(90deg,#ef4444,#f97316)"
														: "linear-gradient(90deg,#7c3aed,#a78bfa)",
												}}
											/>
										</div>
									)}
									<p
										className="eav-capacity-hint"
										style={{
											color: dueDateHasConflict ? "#fca5a5" : isDark ? "#a78bfa" : "#6d28d9",
										}}
									>
										{dueDateHasConflict
											? "Hay un conflicto de carga para esta fecha. Puedes guardar y resolverlo después en Conflictos."
											: "No hay conflicto detectado para esa fecha."}
									</p>
								</div>
							)}
						</div>

						<div className="eav-field">
							<label htmlFor="eav-status" style={labelStyle}>
								Estado
							</label>
							<select
								id="eav-status"
								value={status}
								onChange={(e) => setStatus(e.target.value as Activity["status"])}
								style={{
									...fieldStyle,
									appearance: "none" as const,
									cursor: "pointer",
								}}
								data-testid="edit-activity-status-select"
							>
								{statusOptions.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Course name */}
					<div className="eav-field">
						<label htmlFor="eav-course" style={labelStyle}>
							Materia
						</label>
						<input
							id="eav-course"
							value={courseName}
							onChange={(e) => setCourseName(e.target.value)}
							list="eav-subjects-list"
							placeholder="Sin materia"
							style={fieldStyle}
							data-testid="edit-activity-course-input"
						/>
						<datalist id="eav-subjects-list">
							{subjects.map((s) => (
								<option key={s} value={s} />
							))}
						</datalist>
					</div>
				</div>

				{/* ====== FOOTER ====== */}
				<div className="eav-footer">
					<div className="eav-footer-hints">
						{submitted && titleError && (
							<span className="eav-footer-hint">
								<AlertCircle size={13} />
								Falta el título obligatorio
							</span>
						)}
					</div>
					<div className="eav-footer-actions">
						<button
							type="button"
							className="eav-btn eav-btn-ghost"
							onClick={handleGoBack}
							disabled={saving}
							data-testid="edit-activity-cancel-btn"
						>
							Cancelar
						</button>
						<button
							type="button"
							className="eav-btn eav-btn-primary"
							onClick={handleSubmit}
							disabled={saving}
							data-testid="edit-activity-save-btn"
						>
							{saving ? (
								<>
									<Loader2 size={14} className="spin" /> Guardando...
								</>
							) : (
								<>
									<CheckCircle2 size={14} /> Guardar cambios
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
