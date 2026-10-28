/**
 * M3x fields of GET / PATCH me/settings (backend SettingsResponse / UpdateSettingsRequest, spec 12.1.1 + contract
 * section 2). Hand-written until the integration step regenerates types.gen.ts; names match the backend DTO.
 */
export type AddButtonPlacement = 'LEFT' | 'CENTER' | 'RIGHT';

/** Navigation menu items (Todoist Settings › Navigation menu), in Todoist order. */
export type NavMenuItem = 'INBOX' | 'TODAY' | 'UPCOMING' | 'FILTERS_LABELS' | 'REPORTING' | 'BROWSE_TEMPLATES';

export interface NavigationSettingsFields {
  /** Where the floating + button sits; default RIGHT. */
  addButtonPlacement: AddButtonPlacement;
  /** false = every device keeps its own start page (stored on the device). Default true. */
  syncHomeView: boolean;
  /** Show the task count next to the navigation menu items. Default true. */
  navMenuShowTaskCount: boolean;
  /** Menu items shown, in order (absent = hidden). Default: all six. */
  navMenuItems: NavMenuItem[];
}
