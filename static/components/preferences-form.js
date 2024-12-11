import Domo, {html} from '/app/domo.js';

export class PreferencesForm extends Domo {
  handleSubmission(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    this.submit({
      email: this.form.email.value.trim(),
      preferences: this.form.preferences.value.trim(),
    });
  }

  componentDidRender() {
    this.form = this.querySelector('form');
  }

  handleButton() {
    this.form.button.disabled = this.form.preferences.value?.trim() === '';
  }

  render() {
    if (this.dataset.hidden === 'true') {
      return null;
    }

    return html`<form on-submit="handleSubmission">
      <label for="email">${config.settings.email_label}</label>
      <input id="email" autocomplete="off" type="email" name="email" placeholder="${config.settings.email_placeholder}" required />
      <label for="preferences">${config.settings.preferences_label}</label>
      <textarea id="preferences" on-input="handleButton" name="preferences" placeholder="${config.settings.preferences_placeholder}" required />
      <button disabled type="submit" name="button">${config.settings.button_label}</button>
    </form>`;
  }
}