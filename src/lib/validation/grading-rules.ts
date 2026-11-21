/**
 * Exercise.gradingRules (e snapshot de SetExercise): formato combinado com o
 * Backend 2 — { rules?, targets?: { A1: opções } }. Fonte única em
 * ./exercise-content.ts; este módulo mantém o nome antigo para quem já importa.
 */
export {
  apiGradingRulesSchema as gradingRulesSchema,
  gradingRuleOptionsSchema,
  type ApiGradingRules as GradingRules,
  type GradingRuleOptions,
} from "./exercise-content";
