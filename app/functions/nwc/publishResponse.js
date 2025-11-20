import {NOSTR_RELAY_URL} from '../../constants';

const ABLY_PUBLISH_URL = 'https://api.getalby.com/nwc/publish';

/**
 * Publishes an array of messages to a single relay
 * @param {Array} events - Array of finalized Nostr events to publish
 * @param {string} relayUrl - Single relay URL to publish to
 * @returns {Object} Publishing results with success/failure counts
 */
export async function publishToSingleRelay(events, relayUrl) {
  if (!events || events.length === 0) {
    console.log('No events to publish');
    return {successful: 0, total: 0, failed: 0};
  }

  if (!relayUrl) {
    throw new Error('Relay URL is required');
  }

  console.log(`📝 Publishing ${events.length} events to ${relayUrl}`);

  try {
    // Create publish promises for all events
    const publishPromises = events.map(async (event, index) => {
      try {
        const response = await fetch(ABLY_PUBLISH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            relayUrl: NOSTR_RELAY_URL,
            event,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTPS ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(result);
        return result;
      } catch (error) {
        console.error(`Fetch failed for event ${index}:`, error);
        throw error;
      }
    });

    // Wait for all events to be published
    await Promise.allSettled(publishPromises);
  } catch (error) {
    console.error('Error during bulk publishing:', error);
  }
}
