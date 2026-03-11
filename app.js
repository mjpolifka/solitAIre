const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_TO_FOUNDATION = { "♠": 0, "♥": 1, "♦": 2, "♣": 3 };
const RANKS = [
  { label: "A", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 }
];

const tableauContainer = document.getElementById("tableau");
const foundationsContainer = document.getElementById("foundations");
const stockEl = document.getElementById("stock");
const wasteEl = document.getElementById("waste");
const statusEl = document.getElementById("status");
const newGameBtn = document.getElementById("new-game");
const winModal = document.getElementById("win-modal");
const playAgainBtn = document.getElementById("play-again");

const state = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  selected: null,
  dragging: null
};

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank.label}${suit}`,
        suit,
        rank: rank.label,
        value: rank.value,
        faceUp: false,
        color: suit === "♥" || suit === "♦" ? "red" : "black"
      });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function startGame() {
  const deck = shuffle(createDeck());
  state.stock = [];
  state.waste = [];
  state.foundations = [[], [], [], []];
  state.tableau = [[], [], [], [], [], [], []];
  state.selected = null;
  state.dragging = null;

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = deck.pop();
      card.faceUp = row === col;
      state.tableau[col].push(card);
    }
  }

  state.stock = deck.map((card) => ({ ...card, faceUp: false }));
  setStatus("New game started. Drag cards or click stock to draw.");
  render();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function cardToText(card) {
  return `${card.rank}${card.suit}`;
}

function canMoveToFoundation(card, foundationPile) {
  if (foundationPile.length === 0) return card.value === 1;
  const top = foundationPile[foundationPile.length - 1];
  return top.suit === card.suit && card.value === top.value + 1;
}

function canMoveToTableau(card, tableauPile) {
  if (tableauPile.length === 0) return card.value === 13;
  const top = tableauPile[tableauPile.length - 1];
  if (!top.faceUp) return false;
  return top.color !== card.color && card.value === top.value - 1;
}

function pullMovingCards(from) {
  if (from.type === "waste") {
    if (state.waste.length === 0) return null;
    return { from, cards: [state.waste[state.waste.length - 1]] };
  }

  if (from.type === "foundation") {
    const pile = state.foundations[from.index];
    if (pile.length === 0) return null;
    return { from, cards: [pile[pile.length - 1]] };
  }

  if (from.type === "tableau") {
    const pile = state.tableau[from.index];
    const cardIndex = pile.findIndex((card) => card.id === from.cardId);
    if (cardIndex < 0) return null;
    const moving = pile.slice(cardIndex);
    if (!moving[0].faceUp) return null;
    return { from: { ...from, cardIndex }, cards: moving };
  }

  return null;
}

function removeFromSource(moving) {
  const { from, cards } = moving;
  if (from.type === "waste") {
    state.waste.pop();
  } else if (from.type === "foundation") {
    state.foundations[from.index].pop();
  } else if (from.type === "tableau") {
    state.tableau[from.index].splice(from.cardIndex, cards.length);
  }
}

function flipTableauIfNeeded(from) {
  if (from.type !== "tableau") return;
  const pile = state.tableau[from.index];
  if (pile.length > 0) pile[pile.length - 1].faceUp = true;
}

function isWin() {
  return state.foundations.every((pile) => pile.length === 13);
}

function moveCards(from, to) {
  const moving = pullMovingCards(from);
  if (!moving) return false;

  if (to.type === "foundation") {
    if (moving.cards.length !== 1) return false;
    const card = moving.cards[0];
    if (!canMoveToFoundation(card, state.foundations[to.index])) return false;
    state.foundations[to.index].push(card);
  } else if (to.type === "tableau") {
    if (!canMoveToTableau(moving.cards[0], state.tableau[to.index])) return false;
    state.tableau[to.index].push(...moving.cards);
  } else {
    return false;
  }

  removeFromSource(moving);
  flipTableauIfNeeded(moving.from);
  state.selected = null;
  state.dragging = null;

  if (isWin()) {
    setStatus("You won! Start a new game anytime.");
    winModal.showModal();
  } else {
    setStatus(`Moved ${cardToText(moving.cards[0])}.`);
  }

  render();
  return true;
}

function drawFromStock() {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) {
      setStatus("No cards to draw.");
      return;
    }
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
    state.selected = null;
    setStatus("Stock refilled from waste.");
    render();
    return;
  }

  const card = state.stock.pop();
  card.faceUp = true;
  state.waste.push(card);
  state.selected = null;
  setStatus(`Drew ${cardToText(card)}.`);
  render();
}

function canSelect(source) {
  if (source.type === "waste") return state.waste.length > 0;
  if (source.type === "foundation") return state.foundations[source.index].length > 0;
  if (source.type === "tableau") {
    const pile = state.tableau[source.index];
    const card = pile.find((candidate) => candidate.id === source.cardId);
    return Boolean(card && card.faceUp);
  }
  return false;
}

function sameSelection(a, b) {
  return a.type === b.type && a.index === b.index && a.cardId === b.cardId;
}

function handleCardClick(source) {
  if (state.selected && sameSelection(source, state.selected)) {
    state.selected = null;
    setStatus("Selection cleared.");
    render();
    return;
  }

  if (state.selected) {
    const target = source.type === "foundation" || source.type === "tableau"
      ? { type: source.type, index: source.index }
      : { type: "waste", index: 0 };
    const moved = moveCards(state.selected, target);
    if (!moved) {
      setStatus("Invalid move.");
      state.selected = null;
      render();
    }
    return;
  }

  if (!canSelect(source)) {
    setStatus("That card cannot be moved.");
    return;
  }

  state.selected = source;
  setStatus("Card selected. Click a destination pile or drag it.");
  render();
}

function attemptAutoFoundationFrom(source) {
  const moving = pullMovingCards(source);
  if (!moving || moving.cards.length !== 1) return;
  const card = moving.cards[0];
  const foundationIndex = SUIT_TO_FOUNDATION[card.suit];
  if (!canMoveToFoundation(card, state.foundations[foundationIndex])) return;
  moveCards(source, { type: "foundation", index: foundationIndex });
}

function onDragStart(event, source) {
  if (!canSelect(source)) {
    event.preventDefault();
    return;
  }

  state.dragging = source;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(source));
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function getDraggedSource(event) {
  if (state.dragging) return state.dragging;
  try {
    const raw = event.dataTransfer.getData("text/plain");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function onDropToTarget(event, target) {
  event.preventDefault();
  const source = getDraggedSource(event);
  state.dragging = null;
  if (!source) return;

  const moved = moveCards(source, target);
  if (!moved) {
    setStatus("Invalid move.");
    render();
  }
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

function renderStock() {
  stockEl.replaceChildren();
  if (state.stock.length === 0) return;
  const card = document.createElement("div");
  card.className = "card face-down";
  stockEl.append(card);
}

function renderWaste() {
  wasteEl.replaceChildren();

  if (state.waste.length === 0) return;

  const top = state.waste[state.waste.length - 1];
  const node = buildCardNode(top, { type: "waste", index: 0, cardId: top.id });
  wasteEl.append(node);
}

function renderFoundations() {
  foundationsContainer.replaceChildren();

  SUITS.forEach((suit, index) => {
    const slot = document.createElement("div");
    slot.className = "pile-slot";

    const title = document.createElement("h2");
    title.textContent = "Foundation";

    const pile = document.createElement("div");
    pile.className = "foundation";
    pile.dataset.label = suit;
    pile.addEventListener("click", () => {
      if (!state.selected) return;
      const moved = moveCards(state.selected, { type: "foundation", index });
      if (!moved) {
        setStatus("Invalid move.");
        state.selected = null;
        render();
      }
    });
    pile.addEventListener("dragover", allowDrop);
    pile.addEventListener("drop", (event) => onDropToTarget(event, { type: "foundation", index }));

    if (state.foundations[index].length > 0) {
      const top = state.foundations[index][state.foundations[index].length - 1];
      const node = buildCardNode(top, { type: "foundation", index, cardId: top.id });
      pile.append(node);
    }

    slot.append(title, pile);
    foundationsContainer.append(slot);
  });
}

function renderTableau() {
  tableauContainer.replaceChildren();

  state.tableau.forEach((pileCards, pileIndex) => {
    const pile = document.createElement("div");
    pile.className = "tableau-pile";
    pile.dataset.index = String(pileIndex);

    pile.addEventListener("click", (event) => {
      if (event.target !== pile || !state.selected) return;
      const moved = moveCards(state.selected, { type: "tableau", index: pileIndex });
      if (!moved) {
        setStatus("Invalid move.");
        state.selected = null;
        render();
      }
    });
    pile.addEventListener("dragover", allowDrop);
    pile.addEventListener("drop", (event) => onDropToTarget(event, { type: "tableau", index: pileIndex }));

    pileCards.forEach((card, cardIndex) => {
      const cardSource = { type: "tableau", index: pileIndex, cardId: card.id };
      const node = buildCardNode(card, cardSource);
      node.style.top = `${cardIndex * 26}px`;
      pile.append(node);
    });

    const minHeight = Math.max(116, pileCards.length * 26 + 116);
    pile.style.minHeight = `${minHeight}px`;
    tableauContainer.append(pile);
  });
}

function buildCardNode(card, source) {
  const node = document.createElement("article");
  node.className = `card ${card.color}`;
  if (!card.faceUp) node.classList.add("face-down");
  if (state.selected && sameSelection(source, state.selected)) node.classList.add("selected");

  const draggable = card.faceUp && canSelect(source);
  node.draggable = draggable;
  if (draggable) {
    node.addEventListener("dragstart", (event) => onDragStart(event, source));
    node.addEventListener("dragend", () => {
      state.dragging = null;
    });
  }

  if (card.faceUp) {
    const topRank = document.createElement("span");
    topRank.textContent = `${card.rank}${card.suit}`;

    const bottomRank = document.createElement("span");
    bottomRank.className = "bottom-rank";
    bottomRank.textContent = `${card.rank}${card.suit}`;

    node.append(topRank, bottomRank);
  }

  node.addEventListener("click", (event) => {
    event.stopPropagation();
    handleCardClick(source);
  });

  node.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    attemptAutoFoundationFrom(source);
  });

  return node;
}

stockEl.addEventListener("click", drawFromStock);
stockEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    drawFromStock();
  }
});
newGameBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", startGame);

startGame();
