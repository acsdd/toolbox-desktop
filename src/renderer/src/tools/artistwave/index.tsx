import { Icon } from '../../components/Icon'
import type { ToolDefinition } from '../types'

function ArtistWaveEntry() {
  return (
    <div className="linked-tool artistwave-tool">
      <div className="linked-intro artistwave-intro">
        <span className="linked-intro-icon">
          <Icon name="music" size={26} />
        </span>
        <div>
          <p className="linked-eyebrow">ArtistWave · embedded player</p>
          <h2>One window, your station.</h2>
          <p>
            ArtistWave now opens as a full page inside Toolbox. Use the Player button next to the
            clock to switch to it from anywhere, and go back to the dashboard whenever you like —
            audio keeps playing.
          </p>
          <div className="artistwave-intro-actions">
            <button
              className="primary-button"
              onClick={() => window.dispatchEvent(new CustomEvent('toolbox:open-player'))}
            >
              <Icon name="music" size={15} />
              Open player page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'artistwave',
  name: 'ArtistWave',
  description: 'Your ArtistWave station, embedded beside the rest of your tools.',
  icon: 'music',
  accent: '#2dd4bf',
  order: 5,
  page: 'connected',
  fullPage: true,
  component: ArtistWaveEntry
}
