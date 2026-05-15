import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	ArrowLeft,
	CalendarDays,
	Clock,
	Pencil,
	AlertCircle,
	CheckCircle2,
	Circle,
	BookOpen,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { fetchSubtasks, type Activity, type Subtask } from "@/api/dashboard";
import { formatDate } from "@/pages/Dashboard/utils/dashboardUtils";
import "./ActivityDetailView.css";

export interface ActivityDetailViewProps {
	activities: Activity[];
}

export default function ActivityDetailView({ activities }: ActivityDetailViewProps) {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { isDark } = useTheme();
	const activityId = Number(id);

	// Basic activity data
	const activity = useMemo(
		() => activities.find((a) => a.id === activityId) ?? null,
		[activities, activityId],
	);

	// State for subtasks
	const [subtasks, setSubtasks] = useState<Subtask[]>([]);
	const [loadingSubtasks, setLoadingSubtasks] = useState(false);

	useEffect(() => {
		if (activityId) {
			const load = async () => {
				setLoadingSubtasks(true);
				try {
					const data = await fetchSubtasks(activityId);
					data.sort((a, b) => {
						const dateCmp = new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
						if (dateCmp !== 0) return dateCmp;
						return a.ordering - b.ordering;
					});
					setSubtasks(data);
				} catch (err) {
					console.error(err);
				} finally {
					setLoadingSubtasks(false);
				}
			};
			load();
		}
	}, [activityId]);

	if (!activity) {
		return (
			<div className="adv-container fade-in" style={{ animationDelay: "0.2s" }}>
				<div className="adv-card">
					<div className="adv-header" style={{ border: "none" }}>
						<div className="adv-header-left">
							<div className="adv-header-icon">
								<AlertCircle size={20} />
							</div>
							<div className="adv-header-text">
								<h3>Actividad no encontrada</h3>
								<p className="adv-header-subtitle">No se encontró una actividad con ID {id}</p>
							</div>
						</div>
						<button className="adv-back-btn" onClick={() => navigate("/organizacion")}>
							<ArrowLeft size={15} />
							Volver
						</button>
					</div>
				</div>
			</div>
		);
	}

	function handleGoBack() {
		navigate("/organizacion");
	}

	function handleGoEdit() {
		navigate(`/actividad/${activity?.id}/edit`);
	}

	const statusLabels: Record<string, string> = {
		pending: "Pendiente",
		in_progress: "En progreso",
		completed: "Completado",
	};

	const statusColors: Record<string, string> = {
		pending: isDark ? "#fb923c" : "#ea580c",
		in_progress: isDark ? "#60a5fa" : "#2563eb",
		completed: isDark ? "#4ade80" : "#16a34a",
	};

	const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
	const totalSubtasks = subtasks.length;
	const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

	return (
		<div className="adv-container fade-in">
			<div className="adv-card">
				{/* HEADER */}
				<div className="adv-header">
					<div className="adv-header-left">
						<div
							className="adv-header-icon"
							style={{
								color: statusColors[activity.status] || "#94a3b8",
							}}
						>
							{activity.status === "completed" ? <CheckCircle2 size={26} /> : <Circle size={26} />}
						</div>
						<div className="adv-header-text">
							<h2 className="adv-title">{activity.title}</h2>
							<div className="adv-meta">
								<span className="adv-meta-tag">
									<BookOpen size={14} />
									{activity.course_name || "Sin materia"}
								</span>
								<span
									className="adv-meta-status"
									style={{
										color: statusColors[activity.status],
										border: `1px solid ${statusColors[activity.status]}33`,
									}}
								>
									{statusLabels[activity.status] || activity.status}
								</span>
							</div>
						</div>
					</div>
					<div className="adv-header-actions">
						<button className="adv-btn adv-btn-ghost" onClick={handleGoEdit}>
							<Pencil size={16} />
							Editar detalles
						</button>
						<button className="adv-btn adv-btn-outline" onClick={handleGoBack}>
							<ArrowLeft size={16} />
							Volver
						</button>
					</div>
				</div>

				{/* BODY */}
				<div className="adv-body">
					{/* Details grid */}
					<div className="adv-info-grid">
						<div className="adv-info-card">
							<div className="adv-info-label">
								<BookOpen size={14} /> Descripción
							</div>
							<div
								className="adv-info-value"
								style={{
									whiteSpace: "pre-wrap",
									fontSize: "15px",
									lineHeight: 1.6,
									minHeight: "100px",
									opacity: activity.description ? 1 : 0.4,
								}}
							>
								{activity.description || "Esta actividad no tiene una descripción detallada."}
							</div>
						</div>

						<div className="adv-info-side-grid">
							<div className="adv-info-card mini">
								<div className="adv-info-label">Fecha de entrega</div>
								<div className="adv-info-value flex-val">
									<CalendarDays size={20} color={isDark ? "#c4b5fd" : "#8b5cf6"} />
									{formatDate(activity.due_date)}
								</div>
							</div>
							<div className="adv-info-card mini">
								<div className="adv-info-label">Esfuerzo total</div>
								<div className="adv-info-value flex-val">
									<Clock size={20} color={isDark ? "#93c5fd" : "#3b82f6"} />
									{activity.total_estimated_hours} hrs
								</div>
							</div>
						</div>
					</div>

					{/* Subtasks Section */}
					<div className="adv-subtasks-section">
						<div className="adv-subtasks-header">
							<h3>Subtareas</h3>
							<div className="adv-progress-indicator">
								<div className="adv-progress-text">
									{completedSubtasks} de {totalSubtasks} completadas
								</div>
								<div className="adv-progress-track">
									<div
										className="adv-progress-fill"
										style={{
											width: `${progressPercent}%`,
											background:
												progressPercent === 100
													? "linear-gradient(90deg, #22c55e, #10b981)"
													: "linear-gradient(90deg, #7c3aed, #a78bfa)",
										}}
									/>
								</div>
							</div>
						</div>

						<div className="adv-subtasks-list">
							{loadingSubtasks ? (
								<p className="adv-empty-state">
									<Circle
										className="spin"
										size={24}
										style={{ opacity: 0.5, marginBottom: "10px" }}
									/>
									Cargando subtareas...
								</p>
							) : subtasks.length === 0 ? (
								<div className="adv-empty-state">
									<AlertCircle size={32} style={{ opacity: 0.2, marginBottom: "12px" }} />
									<p>Esta actividad no tiene subtareas registradas.</p>
								</div>
							) : (
								subtasks.map((st) => (
									<div
										key={st.id}
										className={`adv-subtask-item ${st.status === "completed" ? "completed" : ""}`}
									>
										<div
											className="adv-st-icon"
											style={{
												background:
													st.status === "completed"
														? "rgba(34, 197, 94, 0.15)"
														: "rgba(255, 255, 255, 0.05)",
											}}
										>
											{st.status === "completed" ? (
												<CheckCircle2 size={18} color="#4ade80" />
											) : (
												<Circle
													size={18}
													color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}
												/>
											)}
										</div>
										<div className="adv-st-content">
											<div className="adv-st-title">{st.name}</div>
											<div className="adv-st-meta">
												<span>
													<CalendarDays size={12} /> {formatDate(st.target_date)}
												</span>
												<span>
													<Clock size={12} /> {st.estimated_hours} hrs
												</span>
											</div>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
