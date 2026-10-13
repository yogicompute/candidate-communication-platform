export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;