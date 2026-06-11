const maxEmailLength = 254;
const maxLocalPartLength = 64;
const maxDomainLength = 253;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const simpleLocalPartPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function getEmailValidationMessage(email: string) {
  const normalizedEmail = normalizeEmailAddress(email);

  if (!normalizedEmail) {
    return "Please enter your email address.";
  }

  if (normalizedEmail.length > maxEmailLength) {
    return "Email address is too long.";
  }

  if (/\s/.test(normalizedEmail)) {
    return "Email address cannot contain spaces.";
  }

  const parts = normalizedEmail.split("@");

  if (parts.length !== 2) {
    return "Please enter a valid email address.";
  }

  const [localPart, domain] = parts;

  if (!localPart || !domain) {
    return "Please enter a valid email address.";
  }

  if (localPart.length > maxLocalPartLength) {
    return "Email name is too long.";
  }

  if (!simpleLocalPartPattern.test(localPart)) {
    return "Email address contains unsupported characters.";
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return "Email address has an invalid name format.";
  }

  if (domain.length > maxDomainLength || !domain.includes(".")) {
    return "Email domain looks incomplete.";
  }

  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return "Email domain looks incomplete.";
  }

  const labels = domain.split(".");
  const topLevelDomain = labels.at(-1) ?? "";

  if (!/^[a-z]{2,24}$/i.test(topLevelDomain)) {
    return "Email domain must end with a valid extension.";
  }

  if (!labels.every((label) => domainLabelPattern.test(label))) {
    return "Email domain has an invalid format.";
  }

  return "";
}

export function isValidEmailAddress(email: string) {
  return getEmailValidationMessage(email) === "";
}
