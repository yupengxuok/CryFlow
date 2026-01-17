/**
 * Suggestion Generation Service
 * Generates actionable suggestions based on hypotheses
 */

const SAFETY_NOTE = "This is non-medical guidance. Consult pediatrician for concerns.";

/**
 * Generate suggestions from hypotheses
 */
function generateSuggestions(hypotheses, signals) {
  const suggestions = [];
  
  // Generate suggestion for top hypothesis
  const topHypothesis = hypotheses[0];
  
  switch (topHypothesis.label) {
    case 'hunger':
      suggestions.push(generateHungerSuggestion(signals));
      break;
    case 'overtired':
      suggestions.push(generateOvertiredSuggestion(signals));
      break;
    case 'discomfort':
      suggestions.push(generateDiscomfortSuggestion(signals));
      break;
    case 'overstimulated':
      suggestions.push(generateOverstimulatedSuggestion(signals));
      break;
    case 'wants_contact':
      suggestions.push(generateContactSuggestion(signals));
      break;
    case 'unknown':
      suggestions.push(generateUnknownSuggestion(signals));
      break;
    default:
      suggestions.push(generateGenericSuggestion());
  }
  
  // Add secondary suggestion if confidence is close
  if (hypotheses.length > 1 && hypotheses[1].confidence > 0.3) {
    const secondarySuggestion = generateSecondarySuggestion(hypotheses[1], signals);
    if (secondarySuggestion) {
      suggestions.push(secondarySuggestion);
    }
  }
  
  return suggestions;
}

/**
 * Generate hunger suggestion
 */
function generateHungerSuggestion(signals) {
  return {
    title: 'Try feeding',
    steps: [
      'Offer breast or bottle',
      'Ensure baby is in comfortable feeding position',
      'Watch for hunger cues (rooting, sucking)',
      'Burp baby after feeding'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate overtired suggestion
 */
function generateOvertiredSuggestion(signals) {
  return {
    title: 'Create calm sleep environment',
    steps: [
      'Move to quiet, dimly lit room',
      'Swaddle baby if age-appropriate',
      'Use white noise or gentle shushing',
      'Rock or gently sway baby',
      'Avoid overstimulation'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate discomfort suggestion
 */
function generateDiscomfortSuggestion(signals) {
  const steps = ['Check diaper and change if needed'];
  
  if (signals.time_since_last_diaper_min > 180) {
    steps.push('Diaper change is overdue');
  }
  
  steps.push(
    'Check for tight clothing or tags',
    'Ensure comfortable temperature',
    'Look for signs of gas or reflux',
    'Try gentle tummy massage'
  );
  
  return {
    title: 'Check for discomfort',
    steps,
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate overstimulated suggestion
 */
function generateOverstimulatedSuggestion(signals) {
  return {
    title: 'Reduce stimulation',
    steps: [
      'Move to quiet, calm environment',
      'Dim lights and reduce noise',
      'Limit interaction and eye contact',
      'Use gentle, rhythmic motion',
      'Consider offering pacifier'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate contact suggestion
 */
function generateContactSuggestion(signals) {
  return {
    title: 'Provide comfort and contact',
    steps: [
      'Hold baby close to your chest',
      'Use skin-to-skin contact if possible',
      'Gently rock or sway',
      'Speak or sing softly',
      'Try babywearing if available'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate unknown suggestion
 */
function generateUnknownSuggestion(signals) {
  return {
    title: 'Systematic check',
    steps: [
      'Check if baby needs feeding',
      'Check diaper',
      'Check for signs of discomfort',
      'Try holding and comforting',
      'Monitor for other symptoms',
      'Contact pediatrician if crying persists or worsens'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate generic suggestion
 */
function generateGenericSuggestion() {
  return {
    title: 'Monitor baby closely',
    steps: [
      'Observe baby for additional cues',
      'Try basic comfort measures',
      'Note any patterns or changes',
      'Contact pediatrician if concerned'
    ],
    safety_note: SAFETY_NOTE
  };
}

/**
 * Generate secondary suggestion
 */
function generateSecondarySuggestion(hypothesis, signals) {
  switch (hypothesis.label) {
    case 'hunger':
      return {
        title: 'If still fussy after feeding, check for gas',
        steps: [
          'Burp baby thoroughly',
          'Try bicycle legs motion',
          'Gentle tummy massage'
        ],
        safety_note: null
      };
    case 'overtired':
      return {
        title: 'If baby resists sleep, try motion',
        steps: [
          'Take a walk with stroller',
          'Try car ride if safe',
          'Use baby swing'
        ],
        safety_note: null
      };
    case 'discomfort':
      return {
        title: 'If discomfort persists, check temperature',
        steps: [
          'Feel baby\'s neck or back',
          'Adjust clothing layers',
          'Ensure room is comfortable'
        ],
        safety_note: null
      };
    default:
      return null;
  }
}

/**
 * Generate next best questions
 */
function generateNextBestQuestions(hypotheses, signals) {
  const questions = [];
  
  // Questions based on missing data
  if (signals.time_since_last_feed_min === null) {
    questions.push('When did baby last eat?');
  }
  
  if (signals.time_since_last_diaper_min === null) {
    questions.push('When was the last diaper change?');
  }
  
  if (signals.recent_sleep_min === null) {
    questions.push('How long did baby sleep recently?');
  }
  
  // Questions based on top hypothesis
  const topHypothesis = hypotheses[0];
  
  switch (topHypothesis.label) {
    case 'hunger':
      questions.push('Has baby eaten in the last 3 hours?');
      questions.push('Did baby finish the last feeding?');
      break;
    case 'overtired':
      questions.push('How long has baby been awake?');
      questions.push('Did baby sleep well during last nap?');
      break;
    case 'discomfort':
      questions.push('Is baby showing other signs of discomfort?');
      questions.push('Any recent changes in routine or environment?');
      break;
    case 'overstimulated':
      questions.push('Has there been unusual noise or activity?');
      questions.push('Has baby had many visitors or outings?');
      break;
    case 'wants_contact':
      questions.push('Does baby calm when held?');
      questions.push('Has baby been alone for a while?');
      break;
    case 'unknown':
      questions.push('Are there any other symptoms?');
      questions.push('Has anything changed recently?');
      break;
  }
  
  // Return top 3 questions
  return questions.slice(0, 3);
}

module.exports = {
  generateSuggestions,
  generateNextBestQuestions
};
