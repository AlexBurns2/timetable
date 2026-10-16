/* ══════════════════════════════════════════════════════════════════════════
   ENGLISH ADVANCED — YEAR 12

   English 11–12 Syllabus (2024), first examined in 2027. The set texts here
   are the ones being studied: Gwen Harwood's poetry (Texts and Human
   Experiences), The Prince with Julius Caesar (Textual Conversations),
   Warlight (Critical Study of Literature) and the Craft of Writing.

   Two deliberate decisions:

   1. There is no mock HSC mode for English. Marking an essay against criteria
      is not something this site can do honestly.
   2. Nothing in copyright is quoted. Harwood and Ondaatje are discussed by
      poem, scene, structure and idea, never by reproducing their words.
      Extracts for the unseen-text practice are all out of copyright, which is
      also why they can be printed in full here.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Technique drills ───────────────────────────────────────────────────── */
/* Each entry: a line (all out of copyright), the technique it shows, and what
   that technique is doing — the second half is where the marks are. */
const EN_TECH = [
  { line:'Life’s but a walking shadow, a poor player', src:'Macbeth', t:'metaphor',
    why:'it equates life with a brief stage performance, making existence sound borrowed and soon over' },
  { line:'Cry “Havoc!” and let slip the dogs of war', src:'Julius Caesar', t:'metaphor',
    why:'war is figured as a pack of hounds released, so violence sounds like something unleashed rather than chosen' },
  { line:'Friends, Romans, countrymen, lend me your ears', src:'Julius Caesar', t:'tricolon',
    why:'the three-part address widens the audience and builds a rhythm that commands attention before any argument begins' },
  { line:'And bears the palm alone', src:'Julius Caesar', t:'allusion',
    why:'it reaches back to the Roman victor’s palm branch, measuring Caesar against triumphal tradition' },
  { line:'What a piece of work is a man!', src:'Hamlet', t:'exclamation',
    why:'the outburst carries admiration that the speech then undercuts, so the form itself sets up the irony' },
  { line:'The yellow fog that rubs its back upon the window-panes', src:'Prufrock', t:'personification',
    why:'the fog is given an animal body, making the city feel watchful and faintly predatory' },
  { line:'I have measured out my life with coffee spoons', src:'Prufrock', t:'metaphor',
    why:'a life is reduced to a domestic measure, which makes the speaker’s existence sound trivial and rationed' },
  { line:'Season of mists and mellow fruitfulness', src:'To Autumn', t:'alliteration',
    why:'the repeated m sounds slow the line, so the reading itself feels unhurried and ripe' },
  { line:'My heart aches, and a drowsy numbness pains my sense', src:'Ode to a Nightingale', t:'oxymoron',
    why:'numbness that pains holds two opposite sensations together, which is exactly the speaker’s contradictory state' },
  { line:'Half a league, half a league, half a league onward', src:'The Charge of the Light Brigade', t:'repetition',
    why:'the drumming repetition mimics hoofbeats and the momentum of men who cannot stop' },
  { line:'What passing-bells for these who die as cattle?', src:'Anthem for Doomed Youth', t:'rhetorical question',
    why:'it demands a ritual the poem then shows is absent, and the simile in it strips the dead of ceremony' },
  { line:'The stuttering rifles’ rapid rattle', src:'Anthem for Doomed Youth', t:'onomatopoeia',
    why:'the consonants reproduce gunfire, so the sound of the line does the describing' },
  { line:'Because I could not stop for Death — He kindly stopped for me', src:'Dickinson', t:'personification',
    why:'Death becomes a courteous caller, which makes the poem’s calm far more unsettling than horror would be' },
  { line:'I wandered lonely as a cloud', src:'Wordsworth', t:'simile',
    why:'the comparison sets the speaker adrift and above the scene, isolated before the daffodils arrive' },
  { line:'Shall I compare thee to a summer’s day?', src:'Sonnet 18', t:'rhetorical question',
    why:'it opens the poem by proposing a comparison the rest of the sonnet then refuses as inadequate' },
  { line:'Look on my Works, ye Mighty, and despair!', src:'Ozymandias', t:'irony',
    why:'the boast survives on a ruin, so the words mean the opposite of what the king intended' },
  { line:'The sea is calm to-night. The tide is full', src:'Dover Beach', t:'juxtaposition',
    why:'the settled opening is set against the poem’s later desolation, so the calm reads as temporary' },
  { line:'Water, water, every where, Nor any drop to drink', src:'The Ancient Mariner', t:'paradox',
    why:'abundance and deprivation sit in one image, which is the mariner’s punishment in miniature' }
];
const EN_TECH_NAMES = ['metaphor', 'simile', 'personification', 'alliteration', 'onomatopoeia', 'irony',
  'rhetorical question', 'repetition', 'tricolon', 'oxymoron', 'paradox', 'juxtaposition', 'allusion',
  'exclamation', 'hyperbole', 'symbolism', 'enjambment', 'caesura'];

const EN_DEFS = [
  { t:'enjambment', d:'a sentence running past the end of a line without a pause' },
  { t:'caesura', d:'a deliberate pause inside a line, usually marked by punctuation' },
  { t:'juxtaposition', d:'placing two contrasting things side by side so each sharpens the other' },
  { t:'oxymoron', d:'two contradictory words placed together, such as “bitter sweetness”' },
  { t:'paradox', d:'a statement that contradicts itself yet still points at a truth' },
  { t:'allusion', d:'a passing reference to another text, person or event' },
  { t:'motif', d:'an image or idea that recurs through a text and gathers meaning as it does' },
  { t:'tone', d:'the attitude a text takes towards its subject or its reader' },
  { t:'symbolism', d:'an object standing for an idea beyond itself' },
  { t:'anaphora', d:'the same word or phrase beginning several successive clauses' },
  { t:'tricolon', d:'three parallel elements in a row, often building in force' },
  { t:'sibilance', d:'repeated s and sh sounds running through a phrase' }
];

function genEnTechnique(){
  const k = ri(0, 2);
  if (k === 0){                                   // name the technique
    const e = pk(EN_TECH);
    const m = mc(e.t, shuffle(EN_TECH_NAMES.filter(x => x !== e.t)).slice(0, 4));
    return { q:'Which technique is used here?<div class="rvquote">“' + e.line + '”<span class="rvcite">' + e.src + '</span></div>',
      choices:m.choices, answer:m.answer, data:{ kind:'en-tech-name', t:e.t },
      note:'It is ' + e.t + ': ' + e.why + '. In an exam the name alone earns almost nothing — the effect is the mark.' };
  }
  if (k === 1){                                   // the effect, which is where the marks are
    const e = pk(EN_TECH);
    const others = shuffle(EN_TECH.filter(x => x.t !== e.t && x.why !== e.why)).slice(0, 3).map(x => x.why[0].toUpperCase() + x.why.slice(1) + '.');
    const m = mc(e.why[0].toUpperCase() + e.why.slice(1) + '.', others.concat(['It makes the writing sound more interesting.']));
    return { q:'This line uses <b>' + e.t + '</b>. What is its <b>effect</b>?<div class="rvquote">“' + e.line + '”<span class="rvcite">' + e.src + '</span></div>',
      choices:m.choices, answer:m.answer, data:{ kind:'en-tech-effect', t:e.t },
      note:'“It makes it more interesting” is the answer that never earns a mark: an effect has to say what the reader is made to think or feel, and why that matters to the text.' };
  }
  const d = pk(EN_DEFS);
  const m = mc(d.t, shuffle(EN_DEFS.filter(x => x.t !== d.t).map(x => x.t)).slice(0, 4));
  return { q:'Which term means <b>' + d.d + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-tech-def', t:d.t },
    note:'Knowing the right word lets you write about the effect quickly. The term is the shorthand, not the analysis.' };
}

/* ── Thesis and paragraph drills ────────────────────────────────────────── */
const EN_THESIS = [
  { q:'To what extent does the composer’s use of form shape your understanding of human experiences?',
    good:'Harwood’s control of poetic form — the turn at a sonnet’s volta, the breaking of a stanza — enacts the very ruptures in memory and selfhood that her poems describe.',
    bad:['Gwen Harwood wrote a great many poems about memory, childhood and the passing of time, and this essay will discuss several of them in detail.',
         'Form is extremely important in Harwood’s poetry and shapes our understanding of human experiences a great deal throughout the whole collection.',
         'This essay will show how Harwood uses form, imagery, tone and structure to explore a wide range of human experiences in her poetry.'],
    why:'it answers the “to what extent” with a position, names what form actually does, and ties that to the question’s idea rather than listing techniques' },
  { q:'How does a textual conversation between two texts reveal the values of their contexts?',
    good:'Read against The Prince, Shakespeare’s Julius Caesar converts Machiavelli’s cool political calculus into tragedy, exposing an Elizabethan anxiety about legitimacy that Machiavelli’s republican Florence never needed to feel.',
    bad:['Both texts are concerned with politics, power and ambition, and they were written in very different times and places by very different composers.',
         'This essay will compare The Prince and Julius Caesar carefully and show the many similarities and differences between the two texts and their contexts.',
         'Context is important in a textual conversation because it shapes what composers write about and the values they bring to their writing.'],
    why:'it names what the conversation changes, and attaches each value to the context that produced it — a comparison with a point, not a list of likenesses' },
  { q:'Why is a text considered to be of enduring value?',
    good:'Warlight endures because its withheld narration makes the reader perform the novel’s subject: we assemble a past from fragments, and are left as uncertain of it as its narrator is.',
    bad:['Warlight is a very good novel which a great many readers and critics have enjoyed and admired ever since it was first published.',
         'Ondaatje uses a wide range of narrative techniques throughout the novel, all of which make his work valuable to readers today.',
         'This essay will discuss the textual integrity of Warlight and the many reasons it is considered a text of enduring value.'],
    why:'it gives a reason for the value that comes out of how the text is built, which is what Module B asks for' },
  { q:'How does a composer’s craft shape a reader’s response?',
    good:'By withholding the subject of the opening sentence until its final clause, the writer makes the reader wait, so that the discovery arrives as the reader’s own rather than the narrator’s.',
    bad:['The composer uses a great many effective techniques throughout the piece in order to make the reader interested and engaged from beginning to end.',
         'This piece of writing contains imagery, symbolism, tone and a range of other devices that the composer has chosen to include.',
         'Craft is about choosing exactly the right words for the right moment, which is what every good writer tries to do when writing.'],
    why:'it names a single specific choice and traces what it does to the reader, which is the whole of Module C' }
];

function genEnThesis(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk(EN_THESIS);
    const elsewhere = shuffle(EN_THESIS.filter(x => x !== e).map(x => x.good)).slice(0, 1);
    const m = mc(e.good, shuffle(shuffle(e.bad).slice(0, 2).concat(elsewhere)));
    return { q:'Which is the <b>strongest thesis</b> for this question?<div class="rvquote">' + e.q + '</div>',
      choices:m.choices, answer:m.answer, data:{ kind:'en-thesis', q:e.q },
      note:'The strongest one works because ' + e.why + '. The others announce an intention, restate the question, or list techniques — none of which is an argument.' };
  }
  if (k === 1){
    const e = pk([
      { bad:'In the second stanza, the poet uses a metaphor.', why:'it reports a feature instead of making a claim — a topic sentence should state the idea the paragraph will prove',
        good:'The poem’s metaphors of enclosure steadily narrow the speaker’s world until memory becomes the only space left.' },
      { bad:'Firstly, this essay will discuss context.', why:'signposting is not argument; the marker already knows an essay has paragraphs',
        good:'Written under a regime that punished dissent, the play converts political argument into a language of omen and disguise.' },
      { bad:'There are many techniques in this text.', why:'it says nothing that could be disagreed with, so nothing follows from it',
        good:'The text’s shifts in tense keep pulling the reader back into a past the narrator claims to have finished with.' },
      { bad:'The composer wants the reader to feel sad.', why:'it names a vague effect with no mechanism and no link to the question',
        good:'The elegy’s refusal of consolation leaves the reader with grief unresolved, refusing the comfort the form traditionally supplies.' }
    ]);
    const m = mc(e.good, [e.bad, 'The next paragraph will build on this one.', 'This technique is used throughout the text.']);
    return { q:'Which of these works as a <b>topic sentence</b> in an analytical paragraph?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-topic' },
      note:'“' + e.bad + '” fails because ' + e.why + '. A topic sentence should be a claim that the rest of the paragraph argues for.' };
  }
  const e = pk([
    { right:'Claim, then evidence, then analysis of how the evidence proves the claim, then a link back to the question.',
      w:['Evidence, then a technique name, then another piece of evidence.',
         'A summary of the plot, then a quotation, then an opinion.',
         'The question restated, then three techniques, then a conclusion.'] },
    { right:'Integrate the quotation into your own sentence, so the grammar runs through it.',
      w:['Put the quotation on its own line before your analysis.',
         'Use the longest quotation you can find to prove you know the text.',
         'Quote first, then explain the plot around it.'] }
  ]);
  const m = mc(e.right, e.w);
  return { q:'What is the <b>best structure</b> for analytical writing here?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-para' },
    note:'Evidence proves nothing on its own. The marks live in the sentence after the quotation — the one that explains how the language produces the effect you claimed.' };
}

/* ── The craft of writing ───────────────────────────────────────────────── */
function genEnCraft(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { bad:'She was very sad as she walked slowly down the empty street.',
        good:'She counted the shut doors on her way down the street, and did not look up.',
        why:'it shows the state through a specific action rather than naming the emotion and leaning on adverbs' },
      { bad:'The room was messy and it was obvious nobody had been there for a long time.',
        good:'Dust had settled evenly over the table, the chair, the half-finished cup.',
        why:'a concrete detail lets the reader draw the conclusion, which is more convincing than being told it' },
      { bad:'It was a beautiful morning and the birds were singing beautifully.',
        good:'The light came in sideways, and somewhere behind the fence a magpie started up.',
        why:'it replaces an abstract judgement and a repeated word with something observed' },
      { bad:'He was angry. He was so angry that he could not speak at all.',
        good:'He put the cup down with great care, as though it might go off.',
        why:'restraint carries more force than repetition, and the simile does the work of the adjective' }
    ]);
    const m = mc(e.good, [e.bad,
      'She felt extremely sad and upset as she walked very slowly down the completely empty and silent street that afternoon.',
      'It was a very sad and lonely moment for her at that particular time, and she felt it deeply as she went on her way.']);
    return { q:'Which sentence is the <b>stronger piece of writing</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-craft-sentence' },
      note:'The better version works because ' + e.why + '. “Show, don’t tell” is really an instruction about where to put the specific detail.' };
  }
  if (k === 1){
    const e = pk([
      { ask:'an unreliable narrator', a:'a narrator the reader comes to doubt, so the gap between what is said and what happened becomes part of the meaning',
        w:['a narrator who changes between first and third person', 'a narrator who is not the main character', 'a narrator who speaks directly to the reader'] },
      { ask:'in medias res', a:'beginning in the middle of the action, with the background filled in later',
        w:['ending without resolution', 'telling the story strictly in order', 'writing in the present tense'] },
      { ask:'a frame narrative', a:'a story told inside another story, which colours how the inner one is read',
        w:['a story told in flashbacks', 'a story with more than one setting', 'a story told in letters'] },
      { ask:'free indirect discourse', a:'third-person narration that takes on a character’s own words and thinking',
        w:['dialogue written without quotation marks', 'a first-person narrator speaking to the reader', 'an omniscient narrator judging the characters'] },
      { ask:'a volta', a:'the turn in a sonnet where the argument or feeling changes direction',
        w:['the final rhyming couplet', 'the opening image', 'the metre of the poem'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What is <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-craft-term', ask:e.ask },
      note:'Module C rewards using a device deliberately and then being able to say why you used it. Naming it precisely is how you talk about your own choices in the reflection.' };
  }
  const e = pk([
    { ask:'a reflection statement', a:'explain the deliberate choices you made and the effect you intended, with reference to your own writing',
      w:['summarise the plot of what you wrote', 'apologise for what you could not finish', 'describe how long the piece took to write'] },
    { ask:'writing in response to a stimulus', a:'use the stimulus as a point of departure that is visibly present in the finished piece',
      w:['copy the stimulus into the opening line', 'ignore the stimulus and write what you prepared', 'explain the stimulus before starting'] },
    { ask:'the strongest way to end a short piece', a:'return to an earlier image with its meaning changed by what has happened',
      w:['explain the message of the piece', 'finish with a rhetorical question', 'summarise everything that has happened'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'In the Craft of Writing, what should you do with <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-craft-module', ask:e.ask },
    note:'The reflection is marked on the link between intention and effect — it is analysis of your own text, not a summary of it.' };
}

/* Distractors that are all shorter than the answer turn a drill into a
   length-spotting exercise. These mix the item's own wrong options with a
   correct answer borrowed from a different item in the same bank: the same
   length and register, and plainly wrong for the question asked. */
function enOptions(bank, item){
  const borrowed = shuffle(bank.filter(x => x !== item).map(x => x.a)).slice(0, 2);
  return shuffle(shuffle(item.w).slice(0, 2).concat(borrowed)).slice(0, 3);
}

/* ── Texts and human experiences: Gwen Harwood ──────────────────────────
   Harwood's poems are in copyright, so nothing here quotes them. The
   questions are about form, structure, recurring concerns and context —
   which is what the module asks about anyway. */
const EN_HARWOOD = [
  { ask:'the two-sonnet structure of “Father and Child”', a:'the pair sets a child’s first encounter with killing against an adult’s reckoning with a father’s death, so the form itself spans a lifetime',
    w:['the second sonnet retells the same night from the father’s point of view, so the reader hears both sides of one argument',
       'the two sonnets use opposite rhyme schemes in order to show that childhood and adulthood have nothing in common',
       'the poems were written years apart and were only printed together because they share a setting'] },
  { ask:'why “The Violets” moves between two times at once', a:'a present-day moment of scent and memory opens into a childhood scene, so the poem enacts how memory intrudes on the present',
    w:['the poem runs strictly forward from childhood to the present, so the reader watches the speaker grow up in order',
       'the childhood section is marked out as a dream, which lets the poem avoid claiming it really happened',
       'the two time frames are kept carefully separate, so neither is allowed to colour the other'] },
  { ask:'the significance of music in Harwood’s poetry', a:'music stands for an order and transcendence that ordinary life keeps interrupting, and Harwood was a trained musician',
    w:['music is a background detail that fixes the period, in the way a reference to a radio programme would',
       'music always signals contentment in her work, so a poem that mentions it is always a happy one',
       'music appears only in the late poems, after she had given up writing about memory'] },
  { ask:'what “In the Park” does with the sonnet form', a:'it uses a form associated with love and elevation to deliver a flat, bitter admission about motherhood, and the mismatch is the point',
    w:['it abandons the sonnet entirely in favour of free verse, so the lack of form mirrors a life without shape',
       'it uses the elevated form sincerely, to celebrate motherhood as the subject love poetry has always deserved',
       'it keeps the sonnet form only because the poem was written for a competition that required one'] },
  { ask:'a recurring concern across Harwood’s poetry', a:'the way memory, mortality and the self are bound together, so that remembering is both consolation and loss',
    w:['a steady contrast between the corruption of the city and the innocence of the country she grew up in',
       'an insistence that the future will redeem the losses of the past, which gives the poems their optimism',
       'a rejection of religious imagery in favour of a purely scientific account of experience'] },
  { ask:'why context matters for reading “In the Park”', a:'it was written when a woman’s identity was widely assumed to be exhausted by motherhood, which the poem quietly refuses',
    w:['it was written during the war, and the children in the park are refugees from the bombing',
       'it was written for a children’s anthology, which explains the simplicity of its language',
       'the context is irrelevant, because the poem is about a private moment rather than a public one'] },
  { ask:'what the “human experiences” module asks you to notice in a text like this', a:'the anomalies and paradoxes in human behaviour, and how they are represented, not just the themes listed',
    w:['the details of the composer’s life, so that the poems can be read as records of what happened to her',
       'the number and variety of techniques used, since range of technique is what the module is assessing',
       'the moral lesson the reader is meant to take away and apply to their own conduct'] },
  { ask:'how Harwood uses the natural world', a:'landscape and weather carry emotional states and the passing of time, rather than being described for their own sake',
    w:['nature is consistently hostile in her poetry, a threat the speaker has to survive rather than inhabit',
       'she avoids natural imagery almost entirely, preferring interiors and domestic objects',
       'natural images are chosen mainly for their sound, to fill out the rhyme scheme of the stanza'] }
];
function genEnHarwood(){
  const e = pk(EN_HARWOOD);
  const m = mc(e.a, enOptions(EN_HARWOOD, e));
  return { q:'Gwen Harwood — <b>Texts and Human Experiences</b>.<br>' + e.ask[0].toUpperCase() + e.ask.slice(1) + '?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-harwood', ask:e.ask },
    note:'The module rewards writing about how the text represents experience — form, structure and voice doing the work — rather than retelling what happens in the poem.' };
}

/* ── Textual conversations: The Prince and Julius Caesar ─────────────────
   Both texts are out of copyright, so they can be quoted here. */
const EN_CONV = [
  { ask:'Machiavelli’s argument about being feared or loved', a:'it is safer to be feared than loved, because love is held by obligation that people break when it suits them',
    w:['it is safer to be loved than feared, because fear breeds the resentment that ends in rebellion',
       'a prince should aim to be neither, staying obscure enough that no one has reason to move against him',
       'fear and love are equally reliable, so a prince may choose whichever suits his temperament'],
    why:'the claim is practical, not moral — Machiavelli judges a ruler by what works, which is exactly what made the book notorious' },
  { ask:'how Antony’s funeral oration works on the crowd', a:'he repeats that Brutus is “an honourable man” until the repetition turns the phrase into its opposite',
    w:['he accuses the conspirators of murder in his opening line, and the crowd turns on them at once',
       'he reads out the will first, so that the crowd is already angry before Brutus is mentioned',
       'he avoids any mention of the body or the wounds, keeping the speech to abstract principle'],
    why:'it is verbal irony built by repetition, and it shows rhetoric doing precisely what Machiavelli describes: managing appearances to secure power' },
  { ask:'the Machiavellian idea Brutus most clearly lacks', a:'the willingness to finish what the seizure of power requires, rather than acting on principle and trusting his enemies',
    w:['the ability to speak persuasively in public, which is why the crowd never listens to him at all',
       'any real interest in the future of Rome, since he acts only out of personal rivalry with Caesar',
       'the loyalty of the other conspirators, who abandon him before the assassination is carried out'],
    why:'Machiavelli warns that half-measures are fatal; Brutus spares Antony and lets him speak, and the play turns on that decision' },
  { ask:'what the two texts share in their view of appearance and reality', a:'both treat the public performance of virtue as a political instrument separable from actual virtue',
    w:['both argue that a ruler’s true character always shows itself in the end, however well it is hidden',
       'neither is much interested in how rulers are seen, since both are concerned with what they actually do',
       'both insist that a ruler who dissembles will forfeit the support that keeps him in power'],
    why:'Machiavelli advises a prince to seem merciful and faithful; Shakespeare stages conspirators who look like friends, and an orator who claims not to be one' },
  { ask:'a key dissonance between the two texts', a:'The Prince is untroubled by the cost of power, while the play exacts a tragic price from everyone who reaches for it',
    w:['the two texts give incompatible accounts of the historical Caesar and his reign',
       'The Prince is a work of fiction while the play is based closely on the historical record',
       'neither text is finally concerned with politics, which is only the setting for a moral argument'],
    why:'genre carries the values: a treatise can recommend, but a tragedy has to show consequences' },
  { ask:'how context shapes the difference between them', a:'Machiavelli wrote for the fractured city-states of Renaissance Italy, while Shakespeare wrote under a late Elizabethan anxiety about succession and legitimacy',
    w:['both were written within a few years of each other for the same European court audience',
       'Shakespeare wrote first, and Machiavelli set out to answer the questions the play had raised',
       'both were written in periods of settled, uncontested rule, which is why neither fears disorder'],
    why:'Elizabeth had no heir, and staging the assassination of a ruler was risky enough that the Roman setting was a kind of cover' },
  { ask:'what “textual conversation” means in this module', a:'reading one text in the light of the other, so each reframes the ideas and values of its counterpart',
    w:['establishing which text came first and showing what the later one borrowed from it',
       'judging which of the two texts is the more accomplished piece of writing, and defending that view',
       'analysing each text thoroughly in turn, then noting the similarities in a final paragraph'],
    why:'the marks are for the reframing, which is why a paragraph that treats each text in turn without connecting them loses them' },
  { ask:'the function of the crowd in Julius Caesar', a:'it is shown as moveable by whoever speaks last, which makes popular support look like a resource to be won rather than a judgement to be trusted',
    w:['it is shown as a steady moral centre, so the audience can measure the conspirators against it',
       'it is kept offstage throughout, and we learn what the people think only from what the nobles report',
       'it decides nothing of consequence, since the outcome is settled entirely on the battlefield'],
    why:'the same crowd cheers Brutus and then turns on him within one scene, and the murder of Cinna the poet shows what that unleashes' }
];
function genEnConv(){
  const e = pk(EN_CONV);
  const m = mc(e.a, enOptions(EN_CONV, e));
  return { q:'<b>Textual Conversations</b> — <i>The Prince</i> and <i>Julius Caesar</i>.<br>' + e.ask[0].toUpperCase() + e.ask.slice(1) + '?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-conv', ask:e.ask },
    note:e.why[0].toUpperCase() + e.why.slice(1) + '.' };
}

/* ── Critical study of literature: Warlight ─────────────────────────────
   In copyright, so discussed rather than quoted. */
const EN_WAR = [
  { ask:'the effect of Nathaniel narrating from much later in life', a:'the adult reconstruction keeps admitting what it cannot know, so the reader is made to assemble the past the same way he does',
    w:['the distance of years lets him set the record straight, so the account we get is complete and reliable',
       'telling it afterwards removes any suspense, since the reader knows from the first page how it ends',
       'the retrospective frame means the novel is narrated in the present tense as events happen'] },
  { ask:'what the novel’s two-part structure does', a:'the first part lives inside a child’s partial understanding, and the second re-reads the same events with adult knowledge, which changes their meaning without undoing the uncertainty',
    w:['the two parts follow two unrelated sets of characters, and the connection between them is never made',
       'the second part repeats the first almost exactly, so the reader can check the details for themselves',
       'both parts run in strict chronological order, so nothing is ever revisited or reinterpreted'] },
  { ask:'the significance of the title’s “warlight”', a:'it names the dimmed, partial light of wartime blackout, and stands for a way of seeing that is never fully illuminated',
    w:['it refers to the searchlights used to find aircraft, and so to the idea of being hunted from above',
       'it is the name of the boat the characters use to move cargo along the river at night',
       'it is a phrase from a wartime poem the characters quote to each other, with no wider meaning'] },
  { ask:'how the novel treats the end of the war', a:'it shows the aftermath as unfinished business — secrecy, reprisal and consequence continuing long after the declared peace',
    w:['it presents 1945 as a clean break, after which the characters are free to start their lives again',
       'the war is kept entirely offstage, so the novel could be set in any period of upheaval',
       'the aftermath is covered in a short epilogue that ties up what the main narrative left open'] },
  { ask:'why Module B asks about “textual integrity”', a:'it asks how the parts of the text — form, structure, language, ideas — work together as a whole, which is what makes a reading of it defensible',
    w:['it asks whether the composer’s own account of the work matches what the text actually does',
       'it asks whether the historical detail in the text is accurate enough to be relied on',
       'it asks how well the text has held its reputation, measured by sales and later editions'] },
  { ask:'the role of concealment in the novel', a:'characters withhold their histories and their purposes, so trust and knowledge are always partial — the condition the narrator writes from',
    w:['the characters are unusually open with each other, which is what makes the later betrayals land',
       'concealment is confined to the final chapter, where the earlier events are explained at last',
       'the narrator explains each secret as soon as it arises, so the reader is always a step ahead'] },
  { ask:'what an informed personal response means in Module B', a:'a judgement of your own about the text’s value, supported by close analysis and aware of how others have read it',
    w:['an account of how the text made you feel, written honestly and in the first person',
       'a survey of what published critics have said, presented fairly and without taking sides',
       'a thorough catalogue of the composer’s techniques, with an example of each from the text'] },
  { ask:'how landscape and the river work in the novel', a:'they carry the narrative’s concealments — routes used at night, places that hold what people will not say',
    w:['they are description for its own sake, giving the reader a rest between the scenes that matter',
       'they appear only in the second half, once the narrator has left London behind for good',
       'they are there to establish historical accuracy, and carry no thematic weight of their own'] }
];
function genEnWarlight(){
  const e = pk(EN_WAR);
  const m = mc(e.a, enOptions(EN_WAR, e));
  return { q:'<b>Critical Study of Literature</b> — <i>Warlight</i>.<br>' + e.ask[0].toUpperCase() + e.ask.slice(1) + '?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-warlight', ask:e.ask },
    note:'Module B wants a sustained reading of the whole text, held together by how it is made — so structure and narration are usually the strongest ground to argue from.' };
}

/* ── Unseen texts ───────────────────────────────────────────────────────
   Every extract here is out of copyright, which is why it can be printed in
   full. The skills are the ones the unseen section tests: naming what the
   language does, and saying what it makes the reader think. */
const EN_UNSEEN = [
  { t:'Anthem for Doomed Youth', a:'Wilfred Owen, 1917', kind:'poetry',
    x:'What passing-bells for these who die as cattle?<br>Only the monstrous anger of the guns.<br>Only the stuttering rifles’ rapid rattle<br>Can patter out their hasty orisons.',
    qs:[
      { q:'What does the simile “die as cattle” suggest about the deaths described?', a:'that the men are killed in numbers, anonymously and without ceremony, as animals are',
        w:['that the men were brave and died willingly', 'that the battlefield was in the countryside', 'that the soldiers were poorly trained'] },
      { q:'What is the effect of the onomatopoeia in “stuttering rifles’ rapid rattle”?', a:'the sound of gunfire replaces the sound of a funeral service, so war performs the rites it has denied the dead',
        w:['it makes the poem sound cheerful', 'it slows the poem down to a solemn pace', 'it suggests the rifles were faulty'] },
      { q:'What is the tone of the opening question?', a:'bitter and accusing, demanding a ceremony the poem immediately shows is absent',
        w:['calm and detached', 'nostalgic and warm', 'hopeful about the future'] }]},
  { t:'Because I could not stop for Death', a:'Emily Dickinson, c. 1863', kind:'poetry',
    x:'Because I could not stop for Death —<br>He kindly stopped for me —<br>The Carriage held but just Ourselves —<br>And Immortality.',
    qs:[
      { q:'What is the effect of personifying Death as a courteous caller?', a:'it makes death sound civil and unhurried, which is far more unsettling than if it were violent',
        w:['it makes death seem terrifying and sudden', 'it suggests the speaker fears the journey', 'it shows the speaker is still alive'] },
      { q:'What do the dashes contribute?', a:'they break the rhythm into pauses, so the poem moves at the carriage’s unhurried, interrupted pace',
        w:['they show the speaker is agitated and shouting', 'they are decorative and carry no meaning', 'they mark missing words'] },
      { q:'What does the third passenger suggest?', a:'that the journey is not an ending, which quietly reframes the whole scene',
        w:['that the carriage is crowded', 'that the speaker is travelling with a friend', 'that Death has an accomplice'] }]},
  { t:'The Drover’s Wife', a:'Henry Lawson, 1892', kind:'prose',
    x:'The two-roomed house is built of round timber, slabs, and stringy-bark, and floored with split slabs. A big bark kitchen standing at one end is larger than the house itself, verandah included. Bush all around — bush with no horizon, for the country is flat. No ranges in the distance.',
    qs:[
      { q:'What is the effect of the repeated “bush” and the sentence fragments?', a:'the flat, clipped syntax enacts the sameness of the landscape, so the reader feels its monotony rather than being told about it',
        w:['it suggests the bush is varied and beautiful', 'it creates a fast, exciting pace', 'it shows the narrator is confused'] },
      { q:'What does “bush with no horizon” suggest about the woman’s life?', a:'that there is nothing to look towards — no prospect, no relief, no change in sight',
        w:['that the view is obscured by trees she could walk past', 'that she lives near the sea', 'that night is falling'] },
      { q:'How does the description of the house characterise the family’s circumstances?', a:'the rough materials and the kitchen being larger than the house itself point to poverty and to a life organised around work',
        w:['the house is large and comfortable', 'the family has recently become wealthy', 'the house is newly built by tradesmen'] }]},
  { t:'Remember', a:'Christina Rossetti, 1862', kind:'poetry',
    x:'Remember me when I am gone away,<br>Gone far away into the silent land;<br>When you can no more hold me by the hand,<br>Nor I half turn to go yet turning stay.',
    qs:[
      { q:'What does the euphemism “the silent land” do?', a:'it names death without saying the word, which keeps the poem’s tone gentle and controlled',
        w:['it describes an actual country the speaker will travel to', 'it makes the poem sound angry', 'it suggests the speaker will return'] },
      { q:'What is the effect of “half turn to go yet turning stay”?', a:'the hesitating, doubling-back phrasing enacts a reluctance to leave that the line itself performs',
        w:['it shows the speaker leaving decisively', 'it describes a dance', 'it suggests the speaker has forgotten something'] },
      { q:'What is the dominant tone of the extract?', a:'tender and resigned, asking rather than demanding',
        w:['bitter and accusing', 'frightened and urgent', 'detached and clinical'] }]},
  { t:'Dover Beach', a:'Matthew Arnold, 1867', kind:'poetry',
    x:'The sea is calm to-night.<br>The tide is full, the moon lies fair<br>Upon the straits; — on the French coast the light<br>Gleams and is gone; the cliffs of England stand,<br>Glimmering and vast, out in the tranquil bay.',
    qs:[
      { q:'What is the effect of opening with such a settled scene?', a:'the calm sets up a contrast with the desolation the poem turns to, so the peace reads as temporary even before it breaks',
        w:['it establishes that the poem will stay peaceful', 'it shows the speaker is on holiday', 'it has no bearing on what follows'] },
      { q:'What does the light that “gleams and is gone” suggest?', a:'something briefly visible and then lost — an image of certainty that will not hold still',
        w:['that a lighthouse has failed', 'that the speaker is losing his sight', 'that dawn is breaking'] },
      { q:'What is the effect of the caesura after “straits”?', a:'the pause breaks the line’s smoothness, letting the eye shift across the water and hinting at the turn to come',
        w:['it speeds the line up', 'it marks a change of speaker', 'it indicates a missing word'] }]},
  { t:'The Garden Party', a:'Katherine Mansfield, 1922', kind:'prose',
    x:'And after all the weather was ideal. They could not have had a more perfect day for a garden-party if they had ordered it. Windless, warm, the sky without a cloud. Only the blue was veiled with a haze of light gold, as it is sometimes in early summer.',
    qs:[
      { q:'What does beginning with “And after all” achieve?', a:'it drops the reader into a conversation already underway, as though we have joined a household mid-thought',
        w:['it signals that the story is ending', 'it shows the narrator is uncertain', 'it introduces a formal, distant narrator'] },
      { q:'What does “if they had ordered it” suggest about the family?', a:'that they are used to arranging the world to suit them, which the story will go on to test',
        w:['that they had in fact arranged the weather', 'that they are poor and cannot afford much', 'that they dislike parties'] },
      { q:'What is the effect of the short, listed clauses “Windless, warm, the sky without a cloud”?', a:'the clipped list makes the perfection sound effortless and total, with nothing to qualify it',
        w:['it creates a sense of foreboding through long sentences', 'it suggests the narrator is in a hurry', 'it shows the weather is changing'] }]}
];
function genEnUnseen(){
  const t = pk(EN_UNSEEN), item = pk(t.qs);
  const elsewhere = shuffle(EN_UNSEEN.filter(x => x !== t).flatMap(x => x.qs.map(y => y.a))).slice(0, 2);
  const m = mc(item.a, shuffle(shuffle(item.w).slice(0, 2).concat(elsewhere)).slice(0, 3));
  return { q:'<div class="rvquote">' + t.x + '<span class="rvcite">' + t.a + ', <i>' + t.t + '</i></span></div>' + item.q,
    choices:m.choices, answer:m.answer, data:{ kind:'en-unseen', text:t.t },
    note:'In the unseen section, every answer needs the technique, the example and the effect in one movement — and the effect has to be about this extract, not a general statement about ' + (t.kind === 'poetry' ? 'poetry' : 'prose') + '.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_EN_ADV = [
  { id:'ea-skills', name:'Skills', topics:[
    { id:'ea-tech', name:'Techniques & effects', gen:genEnTechnique },
    { id:'ea-thesis', name:'Thesis & paragraphs', gen:genEnThesis },
    { id:'ea-unseen', name:'Unseen texts', gen:genEnUnseen }]},
  { id:'ea-common', name:'Texts & human experiences', topics:[
    { id:'ea-harwood', name:'Gwen Harwood', gen:genEnHarwood }]},
  { id:'ea-moda', name:'Textual conversations', topics:[
    { id:'ea-conv', name:'The Prince & Julius Caesar', gen:genEnConv }]},
  { id:'ea-modb', name:'Critical study', topics:[
    { id:'ea-warlight', name:'Warlight', gen:genEnWarlight }]},
  { id:'ea-modc', name:'The craft of writing', topics:[
    { id:'ea-craft', name:'Craft & reflection', gen:genEnCraft }]}
];
BUILD.english12 = host => revGame(host, { title:'English Advanced (Year 12)',
  how:'Technique drills, unseen texts and thesis practice, plus your set texts. Nothing in copyright is quoted; the unseen extracts are all out of copyright.',
  statKey:'english12', modules:MODULES_EN_ADV });

GAMES.push({ id:'english12', cat:'Revision', year:12, ico:'📖', name:'English Advanced',
  blurb:'Techniques, unseen texts, thesis drills, set texts' });

[MODULES_EN_ADV].forEach(ms => ms.forEach(m => m.topics.forEach(t => { t.gen = tidyQ(t.gen); })));

if (typeof REVISION_PAGE !== "undefined" && REVISION_PAGE) showGrid();
