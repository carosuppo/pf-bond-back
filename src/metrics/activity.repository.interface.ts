export interface IActivityRepository {
  record(userId: number): Promise<void>;
}
