/* =====================================================================
   smart_engine.js — PocketTrack True Multi-Intent Smart Engine (Phase 4)
   Understands user intent across Composer, Voice, Smart Logger & Activity.
   Simultaneously analyzes & connects:
   - People & Ledger (Strict word-boundary matching & Hindi particle parsing)
   - Events & Budget Spaces
   - Subscriptions & Recurring Bills (Context-aware intelligence)
   - Duplicate Detection & Compound Multi-Intent Synthesis
   ===================================================================== */

const SMART_INTENTS = {
  LEDGER_PERSON: 'LEDGER_PERSON',
  EVENT_SPACE: 'EVENT_SPACE',
  RECURRING_SUBSCRIPTION: 'RECURRING_SUBSCRIPTION',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  COMPOUND_MULTI: 'COMPOUND_MULTI',
  NORMAL_ENTRY: 'NORMAL_ENTRY'
};

// Common stopwords to protect short 2-3 character names (e.g., 'Al', 'Om', 'An') from matching dictionary words
const PERSON_NAME_STOPWORDS = new Set([
  'to', 'in', 'me', 'my', 'or', 'so', 'no', 'we', 'he', 'go', 'it', 'at', 'on', 'by',
  'an', 'as', 'is', 'if', 'all', 'out', 'app', 'pay', 'fee', 'tax', 'car', 'gas', 'bus',
  'gym', 'tea', 'bar', 'spa', 'for', 'the', 'and', 'was', 'had', 'her', 'his', 'him', 'did'
]);

/**
 * Multi-intent Analyzer:
 * Evaluates all intent categories across people, events, subscriptions, and duplicates
 * without returning early, allowing compound multi-intent synthesis.
 */
function analyzeTransactionIntent(payload, rawText, context = {}) {
  const text = ((payload?.label || '') + ' ' + (payload?.note || '') + ' ' + (rawText || '')).toLowerCase();
  const amt = parseFloat(payload?.amt) || 0;
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');

  const result = {
    intents: [],
    primaryIntent: SMART_INTENTS.NORMAL_ENTRY,
    person: null,
    ledgerType: 'gave',
    isReimbursement: false,
    event: null,
    subscription: null,
    duplicateOf: null,
    confidence: 0.5,
    explanations: [],
    suggestedActions: []
  };

  // 1. People & Ledger Intelligence (Strict Word Boundaries, Non-Greedy)
  const peopleList = (context.ledgerPeople || (typeof ledgerPeople !== 'undefined' && Array.isArray(ledgerPeople) ? ledgerPeople : []));
  if (peopleList.length > 0) {
    for (const person of peopleList) {
      if (!person || !person.name) continue;
      const pName = person.name.toLowerCase().trim();
      if (pName.length < 2) continue;

      if (pName.length <= 3 && PERSON_NAME_STOPWORDS.has(pName)) continue;

      const escapedName = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Strictly require word boundary / particle before and after person name
      const nameRegex = new RegExp(`(?:^|\\s|[.,!?'"\\(])(?:to|from|with|ko|se|ne)?\\s*${escapedName}(?:$|\\s|[.,!?'"\\)])`, 'i');

      if (nameRegex.test(text)) {
        let ledgerType = 'gave';

        // Strict Hindi & English received parsing with boundary checking
        const isReceived = (payload?.type === 'income') ||
          /\b(received?|recieved?|got\s+from|from|credit(?:ed)?)\b/i.test(text) ||
          /(?:^|\s)(?:se\s+mila|se\s+mile|se\s+aaye|se\s+mil\s+gaye|se\s+prapt|mila|mile|aaye|prapt|paaye)(?:\s|$|[.,!?])/i.test(text) ||
          new RegExp(`${escapedName}\\s+(?:se\\s+mila|se\\s+mile|se\\s+aaye|se|ne\\s+diye)`, 'i').test(text);

        // Strict Hindi & English gave parsing with boundary checking
        const isGave = (payload?.type === 'expense') ||
          /\b(gave|paid|sent|lent|transfer(?:red)?|given)\b/i.test(text) ||
          /(?:^|\s)(?:ko\s+diye|ko\s+diya|ko\s+bheja|diye|diya|bheja)(?:\s|$|[.,!?])/i.test(text) ||
          new RegExp(`(?:to|ko|paid\\s+to)\\s+${escapedName}`, 'i').test(text);

        if (isReceived && !isGave) {
          ledgerType = 'received';
        } else if (isGave) {
          ledgerType = 'gave';
        } else if (payload?.type === 'income') {
          ledgerType = 'received';
        }

        const isReimbursement = /\b(settle|settled|cleared|paid\s+back|reimburse|reimbursed|hisaab|hisab|chuka|chukaya)\b/i.test(text);

        result.person = person;
        result.ledgerType = ledgerType;
        result.isReimbursement = isReimbursement;
        result.intents.push(SMART_INTENTS.LEDGER_PERSON);
        result.explanations.push(
          isHi
            ? `👤 "${person.name}" के साथ खाता मिला (${ledgerType === 'received' ? 'प्राप्त हुए' : 'दिए'})।`
            : `👤 ${person.name} detected in Ledger (${ledgerType === 'received' ? 'received from' : 'paid to'} ${person.name}).`
        );
        break; // Matched primary person
      }
    }
  }

  // 2. Events & Spaces Intelligence (Continues evaluating without early return!)
  const eventList = (context.events || (typeof events !== 'undefined' && Array.isArray(events) ? events : []));
  if (eventList.length > 0) {
    for (const ev of eventList) {
      if (!ev || !ev.name) continue;
      const evName = ev.name.toLowerCase().trim();
      if (evName.length < 3) continue;

      const evEscaped = evName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const evRegex = new RegExp(`(?:^|\\s|[.,!?'"\\(])${evEscaped}(?:$|\\s|[.,!?'"\\)])`, 'i');
      if (evRegex.test(text)) {
        result.event = ev;
        result.intents.push(SMART_INTENTS.EVENT_SPACE);
        result.explanations.push(
          isHi
            ? `🎉 "${ev.name}" आयोजन (Space) मिला।`
            : `🎉 "${ev.name}" event space detected.`
        );
        break; // Matched primary event
      }
    }
  }

  // 3. Subscription & Recurring Intelligence (Intelligent context & false-positive protection)
  const isFoodOrGrocery = payload?.cat === 'food' || /\b(grocery|groceries|supermarket|fruit|vegetable|milk|bread|apple\s+(?:fruit|kg|juice|pie|store))\b/i.test(text);
  const isGymShakerOrClothing = /\b(gym\s+(?:shaker|shoes|bag|clothes|t-shirt|bottle|wear|gloves))\b/i.test(text);

  if (!isFoodOrGrocery && !isGymShakerOrClothing) {
    const brandMatch = text.match(/\b(netflix|spotify|hotstar|disney|prime\s+video|youtube\s+premium|apple\s+(?:music|tv|one|icloud)|icloud|chatgpt|midjourney|gym\s+membership|cult(?:\.fit)?|airtel\s+(?:fiber|broadband)|jio\s+(?:fiber|airfiber)|tatasky|tata\s+play)\b/i);
    const billingMatch = text.match(/\b(monthly\s+plan|quarterly\s+plan|annual\s+plan|subscription|membership\s+fee|auto-debit|autopay|recurring\s+bill|broadband\s+bill|wifi\s+bill|electricity\s+bill|house\s+rent|sip\s+investment|insurance\s+premium|entertainment\s+plan|recharge)\b/i);

    if (brandMatch || billingMatch) {
      const subName = (brandMatch ? brandMatch[0] : (billingMatch ? billingMatch[0] : 'Subscription')).toUpperCase();
      result.subscription = {
        name: subName,
        suggestedFreq: (/\b(yearly|annual|annually)\b/i.test(text) ? 'yearly' : (/\b(quarterly)\b/i.test(text) ? 'quarterly' : 'monthly'))
      };
      result.intents.push(SMART_INTENTS.RECURRING_SUBSCRIPTION);
      result.explanations.push(
        isHi
          ? `💳 ${subName} आवर्ती भुगतान (Subscription) लग रहा है।`
          : `💳 ${subName} looks like a recurring subscription/bill.`
      );
    }
  }

  // 4. Duplicate Detection (Evaluated directly inside Smart Engine)
  const dupFinder = (typeof findDuplicateEntry === 'function' ? findDuplicateEntry : null);
  if (dupFinder && payload) {
    const dup = dupFinder(payload);
    if (dup) {
      result.duplicateOf = dup;
      result.intents.push(SMART_INTENTS.DUPLICATE_ENTRY);
      result.explanations.push(
        isHi
          ? `⚠️ "${dup.label}" ₹${dup.amt} पहले ही दर्ज हो चुका है।`
          : `⚠️ "${dup.label}" ₹${dup.amt} was already logged recently.`
      );
    }
  }

  // 5. Compound Multi-Intent Synthesis
  if (result.intents.length > 1) {
    result.primaryIntent = SMART_INTENTS.COMPOUND_MULTI;
    result.confidence = 0.96;
    
    // Synthesize unified composite explanation
    if (result.person && result.event) {
      result.compoundSummary = isHi
        ? `👤 "${result.person.name}" (खाता) और 🎉 "${result.event.name}" (आयोजन) दोनों मिले। क्या ₹${amt} को "${result.event.name}" के तहत ${result.person.name} के खाते में जोड़ें?`
        : `👤 ${result.person.name} detected (Ledger) AND 🎉 "${result.event.name}" space detected. Connect this ₹${amt} to ${result.person.name} under ${result.event.name}?`;
    } else {
      result.compoundSummary = result.explanations.join(' ');
    }
  } else if (result.intents.length === 1) {
    result.primaryIntent = result.intents[0];
    result.confidence = 0.88;
    result.compoundSummary = result.explanations[0];
  } else {
    result.primaryIntent = SMART_INTENTS.NORMAL_ENTRY;
    result.confidence = 0.5;
    result.compoundSummary = '';
  }

  return result;
}

// --- Smart Confirmation Modal System ---
function showSmartIntentConfirmation(intentData, payload, onProceedNormal, onProceedSmart) {
  let backdrop = document.getElementById('smart-intent-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'smart-intent-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,26,0.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(backdrop);
  }

  let icon = '🧠';
  let title = 'Smart Context Suggestion';
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');

  if (intentData.primaryIntent === SMART_INTENTS.COMPOUND_MULTI) {
    icon = '✨';
    title = isHi ? 'मल्टी-इंटेंट कनेक्शन' : 'Multi-Intent Connection';
  } else if (intentData.primaryIntent === SMART_INTENTS.LEDGER_PERSON) {
    icon = '👤';
    title = isHi ? 'खाता कनेक्शन' : 'Ledger Connection';
  } else if (intentData.primaryIntent === SMART_INTENTS.EVENT_SPACE) {
    icon = '🎉';
    title = isHi ? 'आयोजन कनेक्शन' : 'Space Connection';
  } else if (intentData.primaryIntent === SMART_INTENTS.RECURRING_SUBSCRIPTION) {
    icon = '💳';
    title = isHi ? 'सब्सक्रिप्शन नियम' : 'Subscription Detected';
  } else if (intentData.primaryIntent === SMART_INTENTS.DUPLICATE_ENTRY) {
    icon = '⚠️';
    title = isHi ? 'डुप्लीकेट अलर्ट' : 'Duplicate Alert';
  }

  const explanationText = intentData.compoundSummary || intentData.explanations.join(' ') || (isHi ? 'क्या आप इस एंट्री को स्मार्ट रूप से जोड़ना चाहते हैं?' : 'Would you like to connect this entry?');

  backdrop.innerHTML = `
    <div class="card" style="width:100%;max-width:400px;background:var(--card-solid,#1f1840);border:1px solid rgba(139,92,246,0.35);box-shadow:0 20px 50px rgba(0,0,0,0.65);border-radius:24px;padding:24px 20px;position:relative;animation:popIn 0.25s ease;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#8b5cf6),var(--accent2,#ec4899));display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;margin:0 auto 12px;box-shadow:0 4px 18px rgba(139,92,246,0.45)">
          ${icon}
        </div>
        <h3 style="margin:0 0 6px;font-family:'Space Grotesk',sans-serif;font-size:18px;color:#fff">${title}</h3>
        <p style="margin:0;font-size:13.5px;color:var(--text-dim,#d1d5db);line-height:1.45">${explanationText}</p>
      </div>

      <div class="btn-row" style="gap:10px;margin-top:18px;">
        <button class="btn" style="flex:1;padding:12px;font-size:13px;" id="smart-intent-btn-no">${isHi ? 'नहीं, सामान्य एंट्री' : 'Normal Entry'}</button>
        <button class="btn primary" style="flex:1.2;padding:12px;font-weight:700;font-size:13.5px;" id="smart-intent-btn-yes"><i class="ti ti-check"></i> ${isHi ? 'हाँ, कनेक्ट करें' : 'Yes, Connect'}</button>
      </div>
    </div>
  `;
  backdrop.style.display = 'flex';

  document.getElementById('smart-intent-btn-no').onclick = () => {
    backdrop.style.display = 'none';
    if (typeof onProceedNormal === 'function') onProceedNormal();
  };

  document.getElementById('smart-intent-btn-yes').onclick = () => {
    backdrop.style.display = 'none';
    if (typeof onProceedSmart === 'function') onProceedSmart();
  };
}

// --- Universal Smart Engine Guard (Integrated Multi-Intent Execution) ---
async function maybeGuardAndSaveWithSmartEngine(payload, doSave, rawHint) {
  const runNormal = () => {
    if (typeof maybeGuardAndSave === 'function') {
      maybeGuardAndSave(payload, doSave);
    } else {
      Promise.resolve(doSave()).catch(e => toast('Could not save: ' + e.message, 'error'));
    }
  };

  const intentData = analyzeTransactionIntent(payload, rawHint);

  // 1. COMPOUND MULTI-INTENT (e.g. Person + Event simultaneously)
  if (intentData.primaryIntent === SMART_INTENTS.COMPOUND_MULTI) {
    showSmartIntentConfirmation(
      intentData,
      payload,
      runNormal,
      async () => {
        try {
          if (intentData.event) {
            payload.event = intentData.event.name;
            payload.evId = intentData.event._id;
          }
          if (intentData.person && typeof saveLedgerTx === 'function') {
            await saveLedgerTx(
              intentData.person._id,
              intentData.ledgerType,
              payload.amt,
              (payload.note || payload.label || 'Smart Ledger Entry') + (intentData.event ? ` [${intentData.event.name}]` : '')
            );
          }
          runNormal();
          toast(
            (typeof currentLang !== 'undefined' && currentLang === 'hi')
              ? `खाते और आयोजन दोनों से कनेक्ट किया गया!`
              : `Connected to ${intentData.person?.name || 'Ledger'} & "${intentData.event?.name || 'Event'}"!`,
            'success'
          );
        } catch(e) {
          console.warn('Compound smart execution error:', e);
          runNormal();
        }
      }
    );
    return;
  }

  // 2. SINGLE LEDGER PERSON INTENT
  if (intentData.primaryIntent === SMART_INTENTS.LEDGER_PERSON && intentData.person) {
    showSmartIntentConfirmation(
      intentData,
      payload,
      runNormal,
      async () => {
        try {
          if (typeof saveLedgerTx === 'function') {
            await saveLedgerTx(
              intentData.person._id,
              intentData.ledgerType,
              payload.amt,
              payload.note || payload.label || 'Smart Ledger Entry'
            );
          } else {
            runNormal();
          }
        } catch(e) {
          console.warn('Smart ledger connection fallback:', e);
          runNormal();
        }
      }
    );
    return;
  }

  // 3. SINGLE EVENT SPACE INTENT
  if (intentData.primaryIntent === SMART_INTENTS.EVENT_SPACE && intentData.event) {
    showSmartIntentConfirmation(
      intentData,
      payload,
      runNormal,
      async () => {
        payload.event = intentData.event.name;
        payload.evId = intentData.event._id;
        runNormal();
        toast(`Connected to "${intentData.event.name}"!`, 'success');
      }
    );
    return;
  }

  // 4. SINGLE SUBSCRIPTION INTENT
  if (intentData.primaryIntent === SMART_INTENTS.RECURRING_SUBSCRIPTION) {
    showSmartIntentConfirmation(
      intentData,
      payload,
      runNormal,
      async () => {
        runNormal();
        if (typeof openRecurringModal === 'function') {
          setTimeout(() => openRecurringModal({
            label: payload.label || intentData.subscription?.name || 'Subscription',
            amt: payload.amt,
            cat: payload.cat || 'home',
            freq: intentData.subscription?.suggestedFreq || 'monthly'
          }), 350);
        }
      }
    );
    return;
  }

  // 5. DUPLICATE ENTRY INTENT
  if (intentData.primaryIntent === SMART_INTENTS.DUPLICATE_ENTRY && intentData.duplicateOf) {
    const dup = intentData.duplicateOf;
    const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
    const msg = isHi
      ? `⚠️ "${dup.label}" ₹${dup.amt} हाल ही में दर्ज हो चुका है। क्या फिर भी इसे जोड़ें?`
      : `⚠️ "${dup.label}" ₹${dup.amt} was already logged recently. Add it anyway?`;
    
    if (typeof showAppConfirm === 'function') {
      showAppConfirm(msg, runNormal);
    } else if (confirm(msg)) {
      runNormal();
    }
    return;
  }

  // Default: proceed with normal duplicate-guarded save
  runNormal();
}

window.SMART_INTENTS = SMART_INTENTS;
window.analyzeTransactionIntent = analyzeTransactionIntent;
window.maybeGuardAndSaveWithSmartEngine = maybeGuardAndSaveWithSmartEngine;
