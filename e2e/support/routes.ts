/**
 * Mapa de rotas esperadas. Fonte: wireframes em design/wireframes (login.html)
 * e contratos de API em .fe2-draft/src/lib/services/contracts.ts.
 * Ajuste aqui (um só lugar) se o time de frontend/backend mudar os caminhos.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/cadastro",
  student: {
    trail: "/aluno",
    content: "/aluno/conteudo",
  },
  teacher: {
    results: "/professor/resultados",
    sets: "/professor/conjuntos",
    sections: "/professor/conteudo",
  },
  admin: {
    users: "/admin/usuarios",
    settings: "/admin/configuracoes",
  },
} as const;

export const API = {
  health: "/api/health",
  admin: {
    users: "/api/admin/users",
    user: (id: string) => `/api/admin/users/${id}`,
    config: "/api/admin/config",
  },
  teacher: {
    sections: "/api/teacher/sections",
    sets: "/api/teacher/sets",
    results: "/api/teacher/results",
    studentDetail: (id: string) => `/api/teacher/results/students/${id}`,
  },
} as const;

/** Rotas de página exclusivas de cada papel (TA-003). */
export const PROTECTED_PAGES = {
  aluno: [ROUTES.student.trail],
  professor: [ROUTES.teacher.results, ROUTES.teacher.sets],
  admin: [ROUTES.admin.users, ROUTES.admin.settings],
} as const;
