const CONFIG_STORAGE_KEY = 'jobFillConfig';
const AUTOFILL_SOURCES = [
  { value: 'manual', label: 'Manual entry' },
  { value: 'currentUrl', label: 'Current tab URL' },
  { value: 'role', label: 'Detected role' },
  { value: 'organization', label: 'Detected organization' },
  { value: 'location', label: 'Detected location' },
  { value: 'salary', label: 'Detected salary' },
  { value: 'today', label: 'Today (DD/MM/YYYY)' }
];

let fields = [];
let draggedFieldIndex = null;

document.addEventListener('DOMContentLoaded', () => {
  const sheetIdInput = document.getElementById('sheetId');
  const tabNameInput = document.getElementById('tabName');
  const fieldsContainer = document.getElementById('fields');
  const addFieldButton = document.getElementById('addField');
  const saveButton = document.getElementById('save');
  const status = document.getElementById('status');

  chrome.storage.sync.get([CONFIG_STORAGE_KEY, 'sheetId', 'tabName', 'fields'], (data) => {
    const config = readConfig(data);
    sheetIdInput.value = config.sheetId;
    tabNameInput.value = config.tabName || 'Sheet1';
    fields = config.fields.map(normalizeField);
    renderFields();
  });

  addFieldButton.addEventListener('click', () => {
    fields.push({
      id: '',
      label: '',
      required: false,
      visibleInPopup: true,
      autofillSource: 'manual',
      defaultValueEnabled: false,
      defaultValue: ''
    });
    renderFields();
  });

  saveButton.addEventListener('click', () => {
    const config = {
      sheetId: sheetIdInput.value.trim(),
      tabName: tabNameInput.value.trim(),
      fields: fields.map((field) => ({
        id: field.id.trim(),
        label: field.label.trim(),
        required: Boolean(field.required),
        visibleInPopup: Boolean(field.visibleInPopup),
        autofillSource: field.autofillSource || 'manual',
        defaultValueEnabled: Boolean(field.defaultValueEnabled),
        defaultValue: typeof field.defaultValue === 'string' ? field.defaultValue.trim() : ''
      }))
    };

    const errors = validateConfig(config);
    if (errors.length) {
      showStatus(errors.join(' '), 'error');
      return;
    }

    chrome.storage.sync.set({ [CONFIG_STORAGE_KEY]: config }, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, 'error');
        return;
      }

      fields = config.fields;
      renderFields();
      showStatus('Settings saved.', 'success');
    });
  });

  function renderFields() {
    fieldsContainer.innerHTML = '';

    if (!fields.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No fields yet. Add at least one field to enable the popup.';
      fieldsContainer.appendChild(emptyState);
      return;
    }

    fields.forEach((field, index) => {
      const row = document.createElement('div');
      row.className = 'field-row';
      row.draggable = true;
      row.dataset.index = String(index);
      row.addEventListener('dragstart', (event) => {
        draggedFieldIndex = index;
        row.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      row.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
          row.classList.add('drag-over');
        }
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        row.classList.remove('drag-over');

        if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
          reorderField(draggedFieldIndex, index);
        }
      });
      row.addEventListener('dragend', () => {
        draggedFieldIndex = null;
        clearDragState();
      });

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = 'Drag';
      dragHandle.title = 'Drag to reorder';
      dragHandle.setAttribute('aria-label', `Drag ${field.label || `field ${index + 1}`} to reorder`);

      const labelGroup = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = 'Label';
      label.htmlFor = `field-label-${index}`;
      const labelInput = document.createElement('input');
      labelInput.id = `field-label-${index}`;
      labelInput.type = 'text';
      labelInput.value = field.label;
      labelInput.placeholder = 'e.g. Organization';
      labelInput.addEventListener('input', () => {
        field.label = labelInput.value;
      });
      labelInput.addEventListener('change', () => {
        if (!field.id || field.id === slugify(labelInput.dataset.previousLabel || '')) {
          field.id = makeUniqueId(slugify(labelInput.value), index);
        }
        renderFields();
      });
      labelInput.dataset.previousLabel = field.label;
      labelGroup.append(label, labelInput);

      const idGroup = document.createElement('div');
      const idLabel = document.createElement('label');
      idLabel.textContent = 'Field ID';
      idLabel.htmlFor = `field-id-${index}`;
      const idInput = document.createElement('input');
      idInput.id = `field-id-${index}`;
      idInput.type = 'text';
      idInput.value = field.id;
      idInput.placeholder = 'organization';
      idInput.addEventListener('input', () => {
        field.id = slugify(idInput.value);
      });
      idInput.addEventListener('change', renderFields);
      idGroup.append(idLabel, idInput);

      const sourceGroup = document.createElement('div');
      const sourceLabel = document.createElement('label');
      sourceLabel.textContent = 'Autofill Source';
      sourceLabel.htmlFor = `field-source-${index}`;
      const sourceSelect = document.createElement('select');
      sourceSelect.id = `field-source-${index}`;
      AUTOFILL_SOURCES.forEach((source) => {
        const option = document.createElement('option');
        option.value = source.value;
        option.textContent = source.label;
        option.selected = source.value === field.autofillSource;
        sourceSelect.appendChild(option);
      });
      sourceSelect.addEventListener('change', () => {
        field.autofillSource = sourceSelect.value;
      });
      sourceGroup.append(sourceLabel, sourceSelect);

      const defaultGroup = document.createElement('div');
      defaultGroup.className = 'default-value-group';
      const defaultCheckboxLabel = document.createElement('label');
      defaultCheckboxLabel.className = 'default-toggle';
      const defaultCheckbox = document.createElement('input');
      defaultCheckbox.id = `field-default-enabled-${index}`;
      defaultCheckbox.type = 'checkbox';
      defaultCheckbox.checked = Boolean(field.defaultValueEnabled);
      defaultCheckbox.addEventListener('change', () => {
        field.defaultValueEnabled = defaultCheckbox.checked;
        defaultInput.disabled = !defaultCheckbox.checked;
      });
      defaultCheckboxLabel.append(defaultCheckbox, document.createTextNode('Use default value'));

      const defaultInput = document.createElement('input');
      defaultInput.id = `field-default-value-${index}`;
      defaultInput.type = 'text';
      defaultInput.value = field.defaultValue || '';
      defaultInput.placeholder = 'e.g. Applied';
      defaultInput.disabled = !field.defaultValueEnabled;
      defaultInput.addEventListener('input', () => {
        field.defaultValue = defaultInput.value;
      });
      defaultGroup.append(defaultCheckboxLabel, defaultInput);

      const controls = document.createElement('div');
      const checks = document.createElement('div');
      checks.className = 'checks';
      checks.append(
        makeCheckbox(`field-required-${index}`, 'Required', field.required, (checked) => {
          field.required = checked;
        }),
        makeCheckbox(`field-visible-${index}`, 'Show in popup', field.visibleInPopup, (checked) => {
          field.visibleInPopup = checked;
        })
      );

      const rowActions = document.createElement('div');
      rowActions.className = 'row-actions';
      rowActions.append(
        makeButton('Remove', 'danger', false, () => removeField(index))
      );
      controls.append(checks, rowActions);

      row.append(dragHandle, labelGroup, idGroup, sourceGroup, defaultGroup, controls);
      fieldsContainer.appendChild(row);
    });
  }

  function reorderField(fromIndex, toIndex) {
    const [field] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, field);
    renderFields();
  }

  function clearDragState() {
    fieldsContainer.querySelectorAll('.field-row').forEach((row) => {
      row.classList.remove('dragging', 'drag-over');
    });
  }

  function removeField(index) {
    fields.splice(index, 1);
    renderFields();
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
  }
});

function normalizeField(field) {
  return {
    id: typeof field.id === 'string' ? field.id : '',
    label: typeof field.label === 'string' ? field.label : '',
    required: Boolean(field.required),
    visibleInPopup: field.visibleInPopup !== false,
    autofillSource: AUTOFILL_SOURCES.some((source) => source.value === field.autofillSource)
      ? field.autofillSource
      : 'manual',
    defaultValueEnabled: Boolean(field.defaultValueEnabled),
    defaultValue: typeof field.defaultValue === 'string' ? field.defaultValue : ''
  };
}

function readConfig(data) {
  const storedConfig = data[CONFIG_STORAGE_KEY] || {};

  return {
    sheetId: storedConfig.sheetId || data.sheetId || '',
    tabName: storedConfig.tabName || data.tabName || '',
    fields: Array.isArray(storedConfig.fields)
      ? storedConfig.fields
      : (Array.isArray(data.fields) ? data.fields : [])
  };
}

function validateConfig(config) {
  const errors = [];
  const ids = new Set();

  if (!config.sheetId) errors.push('Sheet ID is required.');
  if (!config.tabName) errors.push('Tab name is required.');
  if (!config.fields.length) errors.push('At least one field is required.');

  config.fields.forEach((field, index) => {
    if (!field.label) errors.push(`Field ${index + 1} needs a label.`);
    if (!field.id) errors.push(`Field ${index + 1} needs an ID.`);
    if (field.id && ids.has(field.id)) errors.push(`Field ID "${field.id}" is duplicated.`);
    ids.add(field.id);
  });

  return errors;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeUniqueId(baseId, currentIndex) {
  const fallback = baseId || `field-${currentIndex + 1}`;
  let candidate = fallback;
  let suffix = 2;

  while (fields.some((field, index) => index !== currentIndex && field.id === candidate)) {
    candidate = `${fallback}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function makeCheckbox(id, labelText, checked, onChange) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input, document.createTextNode(labelText));
  return label;
}

function makeButton(label, className, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}
