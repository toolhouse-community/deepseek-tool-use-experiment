import Domo, {html} from '/app/domo.js';

export class GiftList extends Domo {
  render() {
    if (window.gifts.length === 0) {
      this.style.display = 'none';
      return null;
    }

    return html`
      <h1>Unwrap Your Apps!</h1>
      <preview-tiles />`;
  }
}