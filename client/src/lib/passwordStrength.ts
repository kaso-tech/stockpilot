export type PasswordStrength = {
  score: number;
  label: "Faible" | "Moyen" | "Fort";
};

export function getPasswordStrength(password: string): PasswordStrength {
  const score = [password.length >= 10, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  return { score, label: score <= 2 ? "Faible" : score <= 4 ? "Moyen" : "Fort" };
}
