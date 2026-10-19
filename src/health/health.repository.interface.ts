export interface IHealthRepository {
  checkDatabaseConnection(): Promise<void>;
}
