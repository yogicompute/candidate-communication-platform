export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  name: string;
  body: string;
}
