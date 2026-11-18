import { css } from 'jimu-core'

// Shared by the panel and the map card (which is portalled into the map component's light DOM).
const formStyles = `
  .al-mono {
    font-family: var(--sys-typography-code-font-family, ui-monospace, SFMono-Regular, Consolas, monospace);
    font-variant-numeric: tabular-nums;
  }
  .al-hint {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-hint.is-ok {
    color: var(--sys-color-success-main);
  }
  .al-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-width: 0;
  }
  .al-spacer {
    flex: 1 1 auto;
  }
  .al-grid2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sys-spacing-2);
  }
  .al-grid2 > div {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-1);
    min-width: 0;
  }
  .al-k {
    font-size: 0.6875rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-style {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
  }
  .al-icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .al-link {
    align-self: flex-start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--sys-color-primary-main);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .al-link:hover {
    text-decoration: underline;
  }

  /* segmented control */
  .al-seg {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-surface-paper);
    max-width: 100%;
    flex-wrap: wrap;
  }
  .al-seg button {
    min-height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .al-seg button.is-icon {
    width: 28px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .al-seg button:hover {
    background: var(--sys-color-action-hover);
  }
  .al-seg button[aria-pressed='true'] {
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
  }

  /* field list */
  .al-fields {
    max-height: 176px;
    overflow-y: auto;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .al-field {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    column-gap: var(--sys-spacing-2);
    row-gap: 2px;
    align-items: start;
    margin: 0;
    padding: 6px 8px;
    cursor: pointer;
  }
  .al-field + .al-field {
    border-top: 1px solid var(--sys-color-divider-tertiary);
  }
  .al-field:hover {
    background: var(--sys-color-action-hover);
  }
  .al-field .jimu-checkbox {
    margin-top: 2px;
  }
  .al-field-name {
    display: flex;
    gap: 6px;
    align-items: baseline;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .al-field-order {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sys-color-primary-main);
  }
  .al-field-value {
    grid-column: 2 / 4;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

export const widgetStyle = css`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 0.8125rem;
  background: var(--sys-color-surface-paper);
  color: var(--sys-color-surface-paper-text);

  ${formStyles}

  .al-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: var(--sys-spacing-3);
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-4);
  }
  .al-section {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
  }
  .al-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-section-title label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-weight: 400;
    cursor: pointer;
  }
  .al-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sys-spacing-3);
    padding: var(--sys-spacing-3) var(--sys-spacing-2);
    text-align: center;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-picking {
    color: var(--sys-color-primary-main);
  }
  .al-location {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: 2px 2px 2px 8px;
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-action-hover);
    font-size: 0.75rem;
  }
  .al-location .al-mono {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .al-preview {
    min-height: 56px;
    display: grid;
    place-items: center;
    padding: var(--sys-spacing-3);
    border: 1px dashed var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
    background: repeating-conic-gradient(var(--sys-color-action-hover) 0 25%, transparent 0 50%) 0 0 / 14px 14px;
    overflow: hidden;
  }
  .al-preview-text {
    white-space: pre;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  /* picked points and added labels: number chip + text, actions on hover */
  .al-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .al-list-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 30px;
    padding: 2px 2px 2px 4px;
    border-radius: var(--sys-shape-shape1);
  }
  .al-list-row:hover,
  .al-list-row:focus-within,
  .al-list-row.is-active {
    background: var(--sys-color-action-hover);
  }
  .al-list-row.is-active .al-list-actions {
    opacity: 1;
  }
  .al-n {
    flex: 0 0 18px;
    height: 18px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    font-size: 0.625rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
  }
  .al-list-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .al-list-actions {
    flex: none;
    display: flex;
    gap: 0;
    opacity: 0;
  }
  .al-list-row:hover .al-list-actions,
  .al-list-row:focus-within .al-list-actions {
    opacity: 1;
  }
  .al-mini-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .al-edit {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2);
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .al-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sys-spacing-2);
  }

  /* From layer / Free text */
  .al-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape2);
  }
  .al-tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 28px;
    border: 0;
    border-radius: var(--sys-shape-shape1);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .al-tabs button:hover {
    background: var(--sys-color-action-hover);
  }
  .al-tabs button[aria-selected='true'] {
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
  }

  /* collapsible sections */
  .al-collapse {
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape2);
  }
  .al-collapse-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .al-collapse-head:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
  .al-chev {
    flex: none;
    color: var(--sys-color-surface-paper-hint);
    transition: transform 120ms ease;
  }
  .al-collapse.is-open .al-chev {
    transform: rotate(90deg);
  }
  .al-collapse-title {
    flex: none;
    font-weight: 500;
  }
  .al-summary {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: end;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-aa {
    flex: none;
    width: 28px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: 3px;
    background: repeating-conic-gradient(var(--sys-color-action-hover) 0 25%, transparent 0 50%) 0 0 / 8px 8px;
    font-size: 0.75rem;
    line-height: 1;
  }
  .al-collapse-body {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    padding: 0 10px 10px;
  }
  .al-count {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    font-size: 0.6875rem;
    font-weight: 600;
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
    text-align: center;
  }

  /* style presets */
  .al-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .al-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: 999px;
    background: var(--sys-color-surface-paper);
  }
  .al-chip:hover,
  .al-chip:focus-within {
    border-color: var(--sys-color-primary-main);
  }
  .al-chip > button {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.75rem;
    padding: 2px 4px 2px 10px;
    cursor: pointer;
  }
  .al-chip > button:last-child:first-child {
    padding-right: 10px;
  }
  .al-chip .al-chip-x {
    padding: 2px 6px 2px 2px;
    color: var(--sys-color-surface-paper-hint);
    opacity: 0;
  }
  .al-chip:hover .al-chip-x,
  .al-chip:focus-within .al-chip-x {
    opacity: 1;
  }
  .al-chip.is-new {
    border-style: dashed;
    color: var(--sys-color-surface-paper-hint);
  }
  .al-preset-name {
    display: flex;
    gap: var(--sys-spacing-2);
  }

  .al-placing {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--sys-color-primary-main);
  }
  .al-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--sys-color-primary-main);
  }
  @media (prefers-reduced-motion: no-preference) {
    .al-dot {
      animation: al-pulse 1.4s infinite;
    }
  }
  @keyframes al-pulse {
    50% { opacity: 0.3; }
  }

  .al-footer {
    flex: 0 0 auto;
    display: flex;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-3);
    border-top: 1px solid var(--sys-color-divider-secondary);
  }
  .al-footer .btn {
    flex: 1 1 0;
  }
  .al-footer.is-stacked {
    flex-direction: column;
    align-items: stretch;
  }
  .al-footer.is-stacked .btn {
    flex: none;
    height: 32px;
  }
  .al-status {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    margin: 0 var(--sys-spacing-3) var(--sys-spacing-2);
    padding: 6px 6px 6px 12px;
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-surface-overlay);
    color: var(--sys-color-surface-overlay-text);
    box-shadow: var(--sys-shadow-shadow2);
    font-size: 0.75rem;
  }
  .al-status span {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .al-status button {
    border: 0;
    background: transparent;
    color: var(--sys-color-primary-main);
    font: inherit;
    font-weight: 600;
    padding: 0 4px;
    cursor: pointer;
  }
`

export const bannerStyle = css`
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  display: flex;
  align-items: center;
  gap: var(--sys-spacing-2);
  padding: 4px 4px 4px 12px;
  border-radius: 999px;
  background: var(--sys-color-primary-main);
  color: var(--sys-color-primary-text);
  box-shadow: var(--sys-shadow-shadow2);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: auto;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button {
    flex: none;
    padding: 2px 10px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    background: rgba(255, 255, 255, 0.34);
  }
  button:focus-visible {
    outline: 2px solid var(--sys-color-primary-text);
    outline-offset: 1px;
  }
`
