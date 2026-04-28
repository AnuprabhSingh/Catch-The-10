# 🃏 Catch The 10 – Complete Rules (Based on Game Code)

## 🎯 Objective
The goal is to **capture 10-value cards (10s)** by winning tricks.  
The team that captures more 10s wins the game.

---

## 👥 Players & Teams
- Total players: **4**
- Teams:
  - Player 0 & Player 2 → **Team A**
  - Player 1 & Player 3 → **Team B**
- Players play in turn order (0 → 1 → 2 → 3)

---

## 🂡 Deck & Distribution

### Initial Phase (Important)
- A standard **52-card deck** is used
- Initially, **ONLY 5 cards are dealt to each player**

👉 Remaining cards are **not dealt yet**

---

## 🧠 Game Phases

Your game has **3 phases**:

### 1. 🟡 Trump Discovery Phase
- Players start playing with only 5 cards
- **Trump suit is NOT known yet**

---

### 2. 🔵 Main Game Phase
- After trump is decided:
  - Remaining cards are distributed
  - Game continues normally

---

### 3. 🟢 Finished Phase
- Game ends after all cards are played

---

## 🔥 Trump Suit (MOST IMPORTANT PART)

### 🧩 How Trump is Decided

Trump is **NOT pre-selected**. It is discovered dynamically during gameplay.

### Rule:
- First player plays any card → this defines **base suit**
- Other players must follow suit if possible

### 💥 Trump Creation Condition:
If a player:
- **Does NOT have the base suit**
- Plays a **different suit card**

👉 That suit becomes the **TRUMP SUIT**

---

### Example:
1. Player 0 plays **♥ (Hearts)** → base suit = Hearts  
2. Player 1 has Hearts → must play Hearts  
3. Player 2 does NOT have Hearts → plays ♠ (Spades)  

✅ Now:
- **Spades becomes TRUMP**

---

### ⚠️ Important Notes
- Trump is decided **only once**
- After trump is decided:
  - Remaining deck is distributed
  - Game moves to **Main Phase**

---

## 🔄 Trick Rules

### 🧾 What is a Trick?
- One round where all 4 players play 1 card

---

### 📌 Playing Rules
1. First player sets **base suit**
2. Others must:
   - Follow suit if possible
   - Otherwise play any card

---

## 🏆 Winning a Trick

### Rule Priority:

#### 1. If Trump Cards Exist:
- Highest **trump card wins**

#### 2. If No Trump Played:
- Highest card of **base suit wins**

---

### 👑 Winner:
- Takes all 4 cards
- Starts next trick

---

## 🔟 Scoring System

### 🎯 Primary Score:
- Each **10 card = 1 point**

### ➕ Additional:
- Number of tricks also counted (tie-breaker)

---

### Example:
- Team A captures:
  - 2 tens → Score = 2
- Team B captures:
  - 3 tens → Score = 3

---

## 🧮 Score Tracking (From Code)

```js
scores = {
  teamA: { tens: 0, tricks: 0 },
  teamB: { tens: 0, tricks: 0 }
}
```

---

## 🏁 Game End Condition

Game ends when:
- All cards are played
- No cards left in deck or hands

---

### 🏆 Winner Decision:

1. Team with **more 10s wins**
2. If tie:
   - Team with **more tricks wins**
3. If still tie:
   - Game is a **draw**

---

## 🔁 Turn System
- Fixed order rotation
- Winner of trick plays first in next trick

---

## 📊 Important Game Mechanics

### 🎴 Base Suit
- Suit of first card in a trick

---

### 🂠 Table Cards
- Stores current trick cards
- Cleared after winner is decided

---

### ⛔ Validations
- Cannot play out of turn
- Must follow suit if possible
- Cannot play card not in hand

---

## 🚨 Special Flow (Very Important)

### Sequence:
1. Deal 5 cards
2. Play until:
   - Trump is discovered
3. Finish that trick
4. Deal remaining cards
5. Continue full game

---

## 🧠 Strategy Insights
- Delay revealing trump if possible
- Force opponents to break suit
- Save strong cards for capturing 10s
- Track which suits players lack

---

## 🧾 Example Full Round Flow

1. Initial deal → 5 cards each  
2. Trick starts  
3. Player breaks suit → Trump decided  
4. Trick ends  
5. Remaining cards distributed  
6. Full game continues  
7. Scores calculated  

---

## ⚠️ Common Mistakes (Avoid)
- Playing different suit when you **have base suit**
- Assuming trump exists from start
- Forgetting trump is decided dynamically

---

## 🚀 Summary
- Trump is **not fixed**
- It is **discovered during play**
- Capture **10s to win**
- Trick strategy is key
