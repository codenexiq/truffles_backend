import { logger } from "../../utils/logger.js";
import { maintenanceRepository, type MaintenanceActor, type MaintenanceInput, type MaintenanceLogEntry, type MaintenanceSettings } from "./maintenance.repository.js";

/** What the public website is told. Nothing about who changed it, and no text at all while the site is open. */
export type PublicSiteStatus =
  | { maintenance: { enabled: false } }
  | { maintenance: { enabled: true; title: string; message: string; eta: string | null } };

export class MaintenanceService {
  static get(): Promise<MaintenanceSettings> {
    return maintenanceRepository.get();
  }

  static history(limit = 10): Promise<MaintenanceLogEntry[]> {
    return maintenanceRepository.log(limit);
  }

  static async update(input: MaintenanceInput, actor: MaintenanceActor): Promise<MaintenanceSettings> {
    const saved = await maintenanceRepository.save(input, new Date().toISOString(), actor);
    logger.warn(`Maintenance mode ${saved.enabled ? "ON" : "off"} (set by ${actor.name})`);
    return saved;
  }

  static async publicStatus(): Promise<PublicSiteStatus> {
    const m = await maintenanceRepository.get();
    return m.enabled ? { maintenance: { enabled: true, title: m.title, message: m.message, eta: m.eta } } : { maintenance: { enabled: false } };
  }
}
