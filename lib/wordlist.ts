/**
 * 512-word list for recovery phrase generation.
 * 512 = 2^9 → each word encodes 9 bits → 12 words = 108 bits of entropy.
 * Selection is unbiased: crypto.getRandomValues uint16 % 512 = exact divisor (65536/512=128).
 */
export const WORDLIST: readonly string[] = [
  // A
  'able', 'acid', 'aged', 'also', 'amid', 'arch', 'army', 'arts',
  'atom', 'aunt', 'avid', 'awry', 'axis', 'ache', 'acre', 'aloe',
  // B
  'back', 'bale', 'ball', 'band', 'barn', 'base', 'bath', 'beam',
  'bean', 'bear', 'beat', 'bell', 'belt', 'bend', 'bird', 'bite',
  'blue', 'boat', 'body', 'bold', 'bone', 'book', 'bore', 'born',
  'both', 'bull', 'bump', 'burn', 'byte', 'bale', 'bard', 'bark',
  // C
  'cafe', 'calm', 'camp', 'cape', 'card', 'care', 'cart', 'case',
  'cash', 'cast', 'cave', 'cell', 'cent', 'chip', 'city', 'coal',
  'coat', 'code', 'coil', 'coin', 'cold', 'colt', 'cord', 'core',
  'cork', 'corn', 'cost', 'coup', 'cove', 'crew', 'crop', 'cube',
  'curb', 'cure', 'curl', 'cyan', 'claw', 'clay', 'club', 'clue',
  // D
  'damp', 'dark', 'dart', 'dash', 'data', 'date', 'dawn', 'dead',
  'deal', 'deck', 'deed', 'deep', 'deer', 'demo', 'dent', 'desk',
  'dice', 'diet', 'dime', 'dirt', 'disk', 'dive', 'dock', 'dome',
  'door', 'dose', 'dove', 'down', 'drag', 'draw', 'drip', 'drop',
  'drum', 'dual', 'dump', 'dusk', 'dust', 'dale', 'daze', 'deft',
  // E
  'earl', 'earn', 'ease', 'east', 'edge', 'emit', 'epic', 'even',
  'ever', 'evil', 'exam', 'exit', 'expo', 'echo', 'etch', 'else',
  // F
  'face', 'fact', 'fail', 'fair', 'fake', 'fall', 'fame', 'farm',
  'fast', 'fate', 'fear', 'feat', 'feed', 'feel', 'feet', 'fell',
  'felt', 'fern', 'file', 'fill', 'film', 'find', 'fine', 'fire',
  'firm', 'fish', 'fist', 'five', 'flag', 'flaw', 'flip', 'flow',
  'foam', 'fold', 'folk', 'fond', 'food', 'foot', 'form', 'fort',
  'fuel', 'fuse', 'fawn', 'flux', 'frog', 'from', 'fund', 'fume',
  // G
  'gale', 'game', 'gate', 'gave', 'gaze', 'gear', 'gift', 'gild',
  'glad', 'glow', 'glue', 'goal', 'gold', 'gone', 'good', 'grab',
  'gray', 'grid', 'grin', 'grip', 'grit', 'grow', 'gust', 'guts',
  'gale', 'germ', 'gust', 'gulf', 'gown', 'glee', 'glob', 'gale',
  // H
  'hail', 'hair', 'half', 'hall', 'halt', 'hand', 'hang', 'hard',
  'harm', 'harp', 'hash', 'hate', 'have', 'hawk', 'haze', 'head',
  'heal', 'heap', 'hear', 'heat', 'heel', 'heir', 'held', 'helm',
  'help', 'herb', 'hero', 'high', 'hill', 'hint', 'hold', 'hole',
  'holy', 'home', 'hone', 'hope', 'horn', 'host', 'hour', 'hull',
  'hump', 'hung', 'hunt', 'hurl', 'husk', 'hymn', 'hive', 'herd',
  // I
  'idea', 'idle', 'inch', 'into', 'iron', 'isle', 'item', 'itch',
  // J
  'jade', 'jail', 'jazz', 'jolt', 'jump', 'jury', 'just', 'jest',
  'jive', 'junk', 'jeer', 'jinx', 'join', 'jolt', 'jaws', 'jape',
  // K
  'keen', 'kept', 'kind', 'king', 'knee', 'knew', 'knob', 'kelp',
  'kern', 'kilo', 'kite', 'knot', 'keel', 'kink', 'kale', 'kerf',
  // L
  'lack', 'laid', 'lake', 'lame', 'lamp', 'lane', 'last', 'late',
  'lawn', 'lead', 'leaf', 'lean', 'leap', 'left', 'lend', 'lens',
  'less', 'levy', 'lick', 'life', 'lift', 'lime', 'limp', 'line',
  'link', 'lion', 'list', 'live', 'load', 'loan', 'loft', 'logo',
  'loom', 'loop', 'lore', 'loss', 'lost', 'loud', 'love', 'luck',
  'lung', 'lure', 'lurk', 'lute', 'lynx', 'lava', 'laze', 'loch',
  // M
  'mace', 'made', 'mail', 'main', 'make', 'male', 'malt', 'mane',
  'mare', 'mark', 'mash', 'mast', 'math', 'meal', 'mean', 'meet',
  'melt', 'menu', 'mesh', 'mild', 'milk', 'mill', 'mind', 'mine',
  'mint', 'mist', 'mode', 'mold', 'mole', 'moon', 'more', 'most',
  'much', 'mule', 'muse', 'must', 'myth', 'maze', 'mire', 'moss',
  // N
  'nail', 'name', 'nape', 'navy', 'near', 'neck', 'need', 'neon',
  'nest', 'news', 'next', 'nice', 'nine', 'node', 'none', 'noon',
  'norm', 'nose', 'note', 'null', 'numb', 'nuke', 'nook', 'newt',
  // O
  'oath', 'obey', 'odds', 'omen', 'once', 'only', 'open', 'oral',
  'over', 'oven', 'orca', 'orge', 'orbs', 'ooze', 'opal', 'optic',
  // P
  'pace', 'pack', 'page', 'pale', 'palm', 'pane', 'park', 'part',
  'pass', 'past', 'path', 'peak', 'peel', 'peer', 'pent', 'pest',
  'pick', 'pier', 'pile', 'pine', 'pink', 'pipe', 'plan', 'plod',
  'plot', 'plow', 'plum', 'poem', 'poet', 'pole', 'pond', 'pool',
  'poor', 'pore', 'port', 'post', 'pour', 'prey', 'prod', 'prop',
  'pull', 'pump', 'pure', 'push', 'pyre', 'pave', 'pawl', 'pawn',
  // R
  'rack', 'rain', 'ramp', 'rang', 'rank', 'rare', 'rash', 'rate',
  'read', 'real', 'reap', 'redo', 'reed', 'reef', 'reel', 'rely',
  'rent', 'rest', 'ride', 'ring', 'riot', 'rise', 'road', 'roam',
  'roar', 'rock', 'rode', 'role', 'roll', 'roof', 'root', 'rope',
  'rose', 'ruin', 'rule', 'rune', 'rush', 'rust', 'raid', 'raze',
  'rift', 'rime', 'rind', 'ribs', 'rife', 'rill', 'rile', 'ruck',
  // S
  'safe', 'sage', 'sail', 'salt', 'same', 'sand', 'sang', 'sane',
  'sank', 'save', 'scan', 'seal', 'seam', 'seat', 'seed', 'self',
  'sell', 'send', 'sent', 'shed', 'ship', 'shop', 'silk', 'silo',
  'sing', 'sire', 'site', 'size', 'skew', 'skin', 'skip', 'slap',
  'slim', 'slip', 'slow', 'snap', 'snow', 'soap', 'sock', 'soil',
  'sold', 'sole', 'some', 'song', 'soon', 'sore', 'sort', 'soul',
  'soup', 'span', 'spin', 'spot', 'spur', 'star', 'stay', 'stem',
  'step', 'stew', 'stir', 'stop', 'stub', 'such', 'suit', 'sulk',
  'sung', 'sunk', 'sure', 'surf', 'swan', 'swap', 'swim', 'sync',
  // T
  'tail', 'tale', 'talk', 'tall', 'tame', 'tank', 'tape', 'task',
  'team', 'tear', 'tell', 'tend', 'term', 'test', 'text', 'them',
  'then', 'this', 'tide', 'tied', 'tier', 'tilt', 'time', 'tint',
  'tiny', 'tire', 'toll', 'tome', 'tone', 'tool', 'tops', 'tore',
  'torn', 'toss', 'tour', 'town', 'trap', 'tray', 'tree', 'trim',
  'trio', 'trip', 'trod', 'troy', 'true', 'tube', 'tuft', 'tune',
  'turf', 'turn', 'tusk', 'twin', 'twig', 'tyke', 'typo', 'tyre',
  // U–V
  'ugly', 'undo', 'unit', 'upon', 'used', 'user', 'vain', 'vale',
  'vane', 'vary', 'vast', 'veil', 'vein', 'vent', 'very', 'vest',
  'veto', 'view', 'vine', 'void', 'volt', 'vote', 'vole', 'vibe',
  // W
  'wade', 'wage', 'wake', 'walk', 'wall', 'wane', 'ward', 'warm',
  'warp', 'wart', 'wary', 'wave', 'weak', 'weld', 'well', 'went',
  'were', 'west', 'whip', 'wide', 'wile', 'will', 'wilt', 'wind',
  'wine', 'wing', 'wink', 'wire', 'wise', 'wish', 'wisp', 'with',
  'woke', 'womb', 'wood', 'wool', 'word', 'wore', 'work', 'worm',
  'worn', 'wove', 'wrap', 'wren', 'writ', 'wry',  'whim', 'waif',
  // Y–Z
  'yard', 'yarn', 'yawn', 'year', 'yell', 'yore', 'your', 'yuck',
  'zeal', 'zero', 'zinc', 'zone', 'zoom', 'zest', 'zany', 'zap',
] as const
