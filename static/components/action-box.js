import Domo, {html} from '/domo.js';

export class ActionBox extends Domo {
  handleClick({ target }) {
    console.log(target.dataset.key);
  }

  render() {
    return config.suggested_actions.map(({ title, label }, key) => html`
      <button data-key="${key}" on-click="handleClick">
        <b>${title}</b>
        ${label}
      </button>`)
    return html`<h1 class="blink">You're all set</h1>
      <p>${config.main.all_set_label}</p>`;
  }
}