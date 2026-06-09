export type PasswordStrength = "empty" | "too-weak" | "weak" | "good" | "strong";

export type PasswordPolicyResult = {
  strength: PasswordStrength;
  label: string;
  score: number;
  isValid: boolean;
  issues: string[];
  metRequirements: string[];
};

const minimumPasswordLength = 10;

const passwordRequirements = [
  {
    label: `At least ${minimumPasswordLength} characters`,
    test: (password: string) => password.length >= minimumPasswordLength,
  },
  {
    label: "Uppercase and lowercase letters",
    test: (password: string) => /[A-Z]/.test(password) && /[a-z]/.test(password),
  },
  {
    label: "At least one number",
    test: (password: string) => /\d/.test(password),
  },
  {
    label: "At least one special character",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
  {
    label: "No spaces",
    test: (password: string) => !/\s/.test(password),
  },
];

function normalizeComparisonValue(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function evaluatePasswordPolicy(
  password: string,
  options: { email?: string; username?: string } = {}
): PasswordPolicyResult {
  if (!password) {
    return {
      strength: "empty",
      label: "Password strength",
      score: 0,
      isValid: false,
      issues: passwordRequirements.map((requirement) => requirement.label),
      metRequirements: [],
    };
  }

  const metRequirements = passwordRequirements
    .filter((requirement) => requirement.test(password))
    .map((requirement) => requirement.label);
  const issues = passwordRequirements
    .filter((requirement) => !requirement.test(password))
    .map((requirement) => requirement.label);

  const lowerPassword = password.toLowerCase();
  const email = normalizeComparisonValue(options.email);
  const username = normalizeComparisonValue(options.username);
  const emailName = email.split("@")[0] ?? "";

  if (emailName.length >= 4 && lowerPassword.includes(emailName)) {
    issues.push("Do not include your email name");
  }

  if (username.length >= 4 && lowerPassword.includes(username)) {
    issues.push("Do not include your username");
  }

  const uniqueCharacters = new Set(password).size;
  if (password.length >= minimumPasswordLength && uniqueCharacters < 5) {
    issues.push("Avoid repeated characters");
  }

  const score = Math.max(0, passwordRequirements.length - issues.length);
  const isValid = issues.length === 0;

  if (isValid && password.length >= 14 && uniqueCharacters >= 8) {
    return {
      strength: "strong",
      label: "Strong password",
      score,
      isValid,
      issues,
      metRequirements,
    };
  }

  if (isValid) {
    return {
      strength: "good",
      label: "Good password",
      score,
      isValid,
      issues,
      metRequirements,
    };
  }

  if (score >= 4) {
    return {
      strength: "weak",
      label: "Almost there",
      score,
      isValid,
      issues,
      metRequirements,
    };
  }

  return {
    strength: "too-weak",
    label: "Too weak",
    score,
    isValid,
    issues,
    metRequirements,
  };
}

