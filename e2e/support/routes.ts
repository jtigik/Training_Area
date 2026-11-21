/**
 * Mapa de rotas esperadas — acordado com o Frontend Developer 2 (21/11/2026).
 * Não há auto-cadastro: o login é só Google/Microsoft (e-mail+senha apenas em dev/teste).
 * Ajuste aqui (um só lugar) se o time de frontend/backend mudar os caminhos.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  // Rotas do aluno confirmadas pelo Frontend Developer 1.
  student: {
    trail: "/aluno",
    content: "/aluno/conteudo",
    exercise: (slug: string) => `/aluno/exercicios/${slug}`,
    levelFeedback: (level: string) => `/aluno/niveis/${level}/feedback`,
  },
  teacher: {
    results: "/professor/resultados",
    sets: "/professor/conjuntos",
    sections: "/professor/conteudo",
    feedbackReview: "/professor/revisao-feedback",
    exerciseBank: "/professor/banco-exercicios", // importação .xlsx fica aqui
    feedbackBands: "/professor/feedback", // TA-027 (confirmada pelo FE2)
    studentDetail: (id: string) => `/professor/resultados/alunos/${id}`, // confirmada pelo FE2
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
    exercises: "/api/teacher/exercises",
    exercise: (id: string) => `/api/teacher/exercises/${id}`,
    // TODO(BE1): confirmar contrato de níveis (BE1 vai exportar a lista selecionável sem DASHBOARD).
    levels: "/api/teacher/levels",
    level: (id: string) => `/api/teacher/levels/${id}`,
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
