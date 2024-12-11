import Domo, {html} from '/app/domo.js';

export class ActionBox extends Domo {
  handleClick(e) {
    e.stopImmediatePropagation();
    const key = e.currentTarget.dataset.key;
    const prompt = config.suggested_actions[key].action;
    this.actionHandler(prompt);
  }

  render() {
    if (this.dataset.hidden === 'true') {
      return null;
    }
    return config.suggested_actions.map(({ title, label }, key) => html`
      <button data-key="${key}" on-click="handleClick">
        <b>${title}</b>
        ${label}
      </button>`)
  }
}