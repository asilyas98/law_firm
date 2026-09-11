export function buildMatterInputData(matter: Record<string, unknown> | null | undefined) {
  if (!matter) return {};
  const clients = matter.clients && typeof matter.clients === 'object' ? (matter.clients as Record<string, unknown>) : null;
  return {
    client_name: clients?.name || matter.client_name || '',
    client_contact_name: clients?.contact_name || '',
    matter_name: matter.matter_name || '',
    matter_description: matter.description || matter.matter_type || '',
    matter_type: matter.matter_type || '',
    requested_deadline: matter.deadline || '',
    assigned_attorney: matter.responsible_attorney || '',
    client_goals: (matter.metadata as Record<string, unknown> | undefined)?.client_goals || '',
  };
}
