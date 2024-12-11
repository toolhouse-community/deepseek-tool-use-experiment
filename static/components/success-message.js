import Domo, {html} from '/app/domo.js';

export class SuccessMessage extends Domo {
  render() {
    return this.dataset.hidden ?
      null :
      html`<h1 class="blink">You're all set</h1>
      <p>${config.main.all_set_label}</p>`;
  }
}