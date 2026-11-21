/**
 * Mapa de rotas esperadas — acordado com o Frontend Developer 2 (21/11/2026).
 * Não há auto-cadastro: o login é só Google/Microsoft (e-mail+senha apenas em dev/teste).
 * Ajuste aqui (um só lugar) se o time de frontend/backend mudar os caminhos.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  student: {
    trail: "/aluno",
    content: "/aluno/conteudo",
  },
  teacher: {
    results: "/professor/resultados",
    sets: "/professor/conjuntos",
    sections: "/professor/conteudo",
    feedbackReview: "/professor/revisao-feedback",
    exerciseBank: "/professor/banco-exercicios", // importação .xlsx fica aqui
    // TODO(FE2): rota das faixas de feedback (TA-027) ainda não acordada.
    feedbackBands: "/professor/feedback",
  },
  admin: {
    // Admin da instituição (escopo: o próprio tenant).
    users: "/admin/usuarios",
    settings: "/admin/configuracoes",
  },
  superAdmin: {
    institutions: "/superadmin/instituicoes",
  },
} as const;

export const API = {
  health: "/api/health",
  admin: {
    users: "/api/admin/users",
    user: (id: string) => `/api/admin/users/${id}`,
    config: "/api/admin/config",
  },
  superAdmin: {
    // TODO(BE1): confirmar contrato.
    institutions: "/api/superadmin/institutions",
  },
  teacher: {
    sections: "/api/teacher/sections",
    sets: "/api/teacher/sets",
    set: (id: string) => `/api/teacher/sets/${id}`,
    exercise: (id: string) => `/api/teacher/exercises/${id}`,
    students: "/api/teacher/students",
    results: "/api/teacher/results",
    studentDetail: (id: string) => `/api/teacher/results/students/${id}`,
    // TODO(BE1/BE2): confirmar contratos de importação e revisão de feedback.
    importXlsx: "/api/teacher/exercises/import",
    feedbackReviews: "/api/teacher/feedback-reviews",
    feedbackReview: (id: string) => `/api/teacher/feedback-reviews/${id}`,
  },
  student: {
    // TODO(BE2): confirmar contratos do aluno.
    levelFeedback: (level: string) => `/api/student/levels/${level}/feedback`,
    redo: (level: string) => `/api/student/levels/${level}/redo`,
  },
} as const;

/** Rotas de página exclusivas de cada papel (TA-003). */
export const PROTECTED_PAGES = {
  aluno: [ROUTES.student.trail],
  professor: [
    ROUTES.teacher.results,
    ROUTES.teacher.sets,
    ROUTES.teacher.sections,
    ROUTES.teacher.feedbackReview,
    ROUTES.teacher.exerciseBank,
  ],
  admin: [ROUTES.admin.users, ROUTES.admin.settings],
  superadmin: [ROUTES.superAdmin.institutions],
} as const;
