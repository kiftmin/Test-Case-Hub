export const roleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ADMIN: { label: "Admin", color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-200" },
  AUTHOR: { label: "Test Author", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200" },
  USER: { label: "User", color: "text-gray-700", bg: "bg-gray-100", border: "border-gray-200" },
  TESTER: { label: "Tester", color: "text-green-700", bg: "bg-green-100", border: "border-green-200" },
  TEST_LEAD: { label: "Test Lead", color: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200" },
  TEST_AUTHOR: { label: "Test Author", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200" },
  BUSINESS_OWNER: { label: "Business Owner", color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-200" },
  DEVELOPER: { label: "Developer", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200" },
};

export function roleBadgeClass(role: string): string {
  const cfg = roleConfig[role];
  if (!cfg) return "bg-gray-100 text-gray-700 border-gray-200";
  return `${cfg.bg} ${cfg.color} ${cfg.border}`;
}

export function roleLabel(role: string): string {
  return roleConfig[role]?.label ?? role;
}
