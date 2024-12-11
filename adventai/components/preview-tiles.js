import Domo, {html} from '/app/domo.js';

export class PreviewTiles extends Domo {
  tiltTile({currentTarget}) {
    const randomAngle = (Math.random() * 4 - 2).toFixed(2); // Random angle between -2 and 2 degrees
    currentTarget.style.transform = `scale(110%) translateY(-10px) rotate(${randomAngle}deg)`;
  }
  
  tiltTileBack({currentTarget}) {
    currentTarget.style.transform = 'translateY(0) rotate(0deg)';
  }

  render() {
    if (window.gifts.length === 0) {
      this.style.display = 'none';
      return null;
    }

    return window.gifts.map(({app_name, title}, i) =>
      html`
        <a 
          href="/app/${app_name}" 
          class="preview-tile" 
          style="transition: all 0.3s ease" 
          on-mouseenter="tiltTile" 
          on-mouseleave="tiltTileBack">
            <generic-icon icon="${app_name}" />
            <div class="preview-tile-overlay">
                <div class="day-tag">Day ${i + 1}</div>
                <h3>${title}</h3>
            </div>
        </a>`)
  }
}