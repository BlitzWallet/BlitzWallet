import {SimplePool} from 'nostr-tools';
import {pushInstantNotification} from '../notifications';

// Configuration
const RELAY_TIMEOUT = 10000; // 5 seconds timeout per message

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

  const pool = new SimplePool();
  const results = {
    successful: 0,
    total: events.length,
    failed: 0,
    details: [],
  };

  try {
    // Create publish promises for all events
    const publishPromises = events.map((event, index) =>
      publishSingleEvent(pool, event, relayUrl, index),
    );

    // Wait for all events to be published
    const publishResults = await Promise.allSettled(publishPromises);

    // Process results
    publishResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.successful++;
        results.details.push({
          eventIndex: index,
          success: true,
        });
      } else {
        results.failed++;
        const error = result.reason || result.value?.error || 'Unknown error';
        results.details.push({
          eventIndex: index,
          success: false,
          error: error,
        });
        console.error(`❌ Event ${index + 1}: Failed -`, error);
      }
    });

    console.log(
      `📊 Results: ${results.successful}/${results.total} events published successfully`,
    );
  } catch (error) {
    console.error('Error during bulk publishing:', error);
    results.failed = results.total;
  } finally {
    // Always close pool connections
    try {
      pool.close([relayUrl]);
    } catch (error) {
      console.warn('Error closing pool:', error);
    }
  }

  return results;
}

/**
 * Publishes a single event to a relay with timeout
 * @param {SimplePool} pool - Nostr pool instance
 * @param {Object} event - Nostr event to publish
 * @param {string} relayUrl - Relay URL
 * @param {number} index - Event index for logging
 * @returns {Object} Result object with success status
 */
async function publishSingleEvent(pool, event, relayUrl, index) {
  try {
    // pool.publish returns array of promises (one per relay)
    const publishPromises = pool.publish([relayUrl], event);

    // Wrap the promise with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout publishing to ${relayUrl}`)),
        RELAY_TIMEOUT,
      ),
    );

    // Race between publish and timeout
    await Promise.race([publishPromises[0], timeoutPromise]);

    return {
      success: true,
      eventId: event.id,
      relay: relayUrl,
      index: index,
    };
  } catch (error) {
    console.error(
      `❌ Error publishing event ${event.id} to ${relayUrl}:`,
      error.message,
    );
    return {
      success: false,
      error: error.message,
      eventId: event.id,
      relay: relayUrl,
      index: index,
    };
  }
}
