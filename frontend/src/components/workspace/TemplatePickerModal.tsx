import type { Template } from "../../api/client";

type TemplatePickerModalProps = {
  open: boolean;
  templates: Template[];
  onClose: () => void;
  onSelectTemplate: (templateId: string | "blank") => void;
};

export function TemplatePickerModal({ open, templates, onClose, onSelectTemplate }: TemplatePickerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal-shell" onClick={(event) => event.stopPropagation()}>
        <div className="row between">
          <h3>Choose a template</h3>
          <button type="button" className="button-neutral" onClick={onClose}>Close</button>
        </div>

        <div className="template-grid">
          <button type="button" className="template-item" onClick={() => onSelectTemplate("blank")}> 
            <strong>📝 Blank Note</strong>
            <small>Start with an empty canvas.</small>
          </button>
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-item"
              onClick={() => onSelectTemplate(template.id)}
            >
              <strong>{template.icon_emoji || "📝"} {template.name}</strong>
              <small>{template.is_builtin ? "Built-in" : "Custom"}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
