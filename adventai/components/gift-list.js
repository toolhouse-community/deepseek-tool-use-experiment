import Domo, {html} from '/app/domo.js';

export class GiftList extends Domo {
  async getInitialState() {
    const response = await fetch('/api/gifts');
    const gifts = await response.json();
    console.log(gifts) 
  }
  
  async render() {
    console.log('render')
    if (window.gifts.length === 0) {
      this.style.display = 'none';
      return null;
    }

    return html`
      <h1>Unwrap Your Apps!</h1>
      <preview-tiles />`;
  }
}