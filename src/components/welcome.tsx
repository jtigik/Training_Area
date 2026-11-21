export const LEVELS = ["Fundamental", "Profissional", "Avançado", "Dashboard"] as const;

export function Welcome() {
  return (
    <section aria-labelledby="welcome-title">
      <h1 id="welcome-title">Training Area</h1>
      <p>Plataforma de treinamento em Excel.</p>
      <ul aria-label="Níveis de conhecimento">
        {LEVELS.map((level) => (
          <li key={level}>{level}</li>
        ))}
      </ul>
    </section>
  );
}
