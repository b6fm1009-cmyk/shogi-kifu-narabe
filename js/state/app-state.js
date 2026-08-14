/**
 * AppState定義・更新関数・派生値算出関数（設計書 第3部）
 */
import { createInitialBoardState } from '../models/board.js';
import { applyMoveToBoard } from '../core/apply-move.js';
import { judgeKifuMode } from '../core/kifu-judge.js';
import { movesEqual } from '../models/move.js';

/**
 * @typedef {Object} SelectedSource
 * @property {'BOARD'|'HAND'} origin - 選択元が盤上か持ち駒か
 * @property {Square|null} square    - origin==='BOARD' の場合の座標。'HAND'の場合はnull。
 * @property {PieceType|null} pieceType - origin==='HAND' の場合の駒種。'BOARD'の場合はnull。
 * @property {Side} side             - 選択した駒の所属
 */

/**
 * @typedef {Object} AppState
 * @property {BoardState} boardState
 * @property {Move[]} moveHistory
 * @property {KifuData|null} kifuData
 * @property {SelectedSource|null} selectedSource
 * @property {boolean} isKifuBarVisible
 * @property {boolean} isNariPopupOpen
 * @property {boolean} isAssetDrawerOpen
 * @property {boolean} isMoveListOpen
 * @property {boolean} isBranchPopupOpen - 分岐選択モーダル（新規要望）の開閉状態
 * @property {string} selectedBoardId
 * @property {string} selectedPieceIdSente - 先手側（自分の駒・自分の持ち駒欄）に使う駒セットID
 * @property {string} selectedPieceIdGote - 後手側（相手の駒・相手の持ち駒欄）に使う駒セットID
 * @property {boolean} isPieceAssetLinked - 修正③（新規要望）: true のとき先手/後手の駒セットを
 *   一括変更する（片方を選ぶと両方に同じIDが反映される）。false のときは従来通り個別に選択できる。
 */

// モジュール内プライベート状態
// 修正①（新規要望）: 先手用・後手用の駒セットを別々に選択できるよう、selectedPieceId（単一）を
// selectedPieceIdSente / selectedPieceIdGote の2つに分割した。両方の初期値は同じデフォルト駒
// （assets-manifest.jsonのdefaults.pieces）にしておくことで、従来通り「先手も後手も同じ駒」の
// 見た目から始まる（ユーザーが片方だけ変更しない限り旧来の挙動と同じに見える）。
// 修正③（新規要望）: isPieceAssetLinked を追加。既存アプリとの比較検討の結果、
// 「先後の駒は基本は一括変更、必要な場合のみ個別変更」の運用が主眼のため、
// 初期値は true（一括）とする。false にすると①の個別選択に戻る。
let state = {
  boardState: createInitialBoardState(null),
  moveHistory: [],
  kifuData: null,
  selectedSource: null,
  isKifuBarVisible: true,
  isNariPopupOpen: false,
  isAssetDrawerOpen: false,
  isMoveListOpen: false,
  isBranchPopupOpen: false,
  selectedBoardId: 'wood',
  selectedPieceIdSente: 'maki_ryoko_1_letter',
  selectedPieceIdGote: 'maki_ryoko_1_letter',
  isPieceAssetLinked: true
};

/**
 * 分岐「次」キャッシュ（新規要望：棋譜分岐中モードの「次」を選択可能にする）。
 *
 * 目的：分岐モード中に「前」で局面を戻した後、再度「次」を押すだけで
 * 直前まで検討していた変化に戻れるようにする。さらに、ある局面から複数の
 * 変化を検討していた場合（例：▲7六歩の次に△3四歩と△8四歩の両方を試した）、
 * 「次」の長押しでそれらの候補を選び直せるようにする。
 *
 * 構造：Map<prefixKey, BranchEntry[]>
 * - prefixKey：「その1手を指す直前の局面」を表すキー。moveHistoryのうち
 *   その手より前の部分（＝その手を指した時点でのprefix）をmovesKey()で
 *   文字列化したもの。「初期局面から何を指したか」ではなく「どの局面から
 *   分岐したか」を示すキーであることに注意。
 * - BranchEntry：{ move: Move, lastUsedAt: number }
 *   その局面から指した1手と、最後に検討（到達）した時刻。同じmoveが
 *   再度指されたらlastUsedAtを更新するだけで、エントリは重複させない
 *   （movesEqual()で同一判定）。
 * - 配列は「最後に検討した順（新しい変化が先頭）」でソートして保持する。
 *   長押しメニューの表示順・「次」の単押しでどちらへ進むかの両方に使う。
 *
 * ライフサイクル：loadKifu()（新規棋譜インポート）で全クリアする。
 * 1つの棋譜を並べている間は保持し続ける（アプリ全体で1つのMapのみ）。
 */
let branchCache = new Map();

/**
 * moveHistoryの配列（の一部）を、Mapのキーとして使える文字列に変換する。
 * @param {Move[]} moves
 * @returns {string}
 */
function movesKey(moves) {
  return JSON.stringify(moves.map(m => [
    m.kind, m.from ? [m.from.file, m.from.rank] : null,
    [m.to.file, m.to.rank], m.pieceType, m.side, m.promoted
  ]));
}

/**
 * 分岐キャッシュに1手を記録する（指し手確定時に呼ぶ）。
 * @param {Move[]} prefix - その手を指す直前のmoveHistory
 * @param {Move} move - 実際に指した手
 */
function recordBranchMove(prefix, move) {
  const key = movesKey(prefix);
  const entries = branchCache.get(key) || [];
  const existingIndex = entries.findIndex(e => movesEqual(e.move, move));
  if (existingIndex !== -1) {
    // 既存の候補を再度指した＝再検討とみなし、最新扱いに更新する
    const [existing] = entries.splice(existingIndex, 1);
    existing.lastUsedAt = Date.now();
    entries.unshift(existing);
  } else {
    entries.unshift({ move, lastUsedAt: Date.now() });
  }
  branchCache.set(key, entries);
}

/**
 * 指定局面（moveHistoryのprefix）から分岐キャッシュに記録されている候補を取得する。
 * 「最後に検討した順」（新しい変化が先頭）で返す。
 * @param {Move[]} prefix
 * @returns {{ move: Move, lastUsedAt: number }[]}
 */
export function getBranchCandidates(prefix) {
  return branchCache.get(movesKey(prefix)) || [];
}

/**
 * 現在の局面から「次」を押した際に進める先の候補一覧を返す（長押しメニュー用）。
 *
 * 修正（分岐モード判定バグ対応）：分岐キャッシュは実際に指した（＝commitMove()や
 * advanceBranch()を経由した）手しか記録しない。ところがインポート直後の棋譜本譜の
 * 手は、ユーザーが一度もその手を「指す」操作をしていなくても存在する（最後ボタン・
 * 手数選択ジャンプ・単なる棋譜読了時点のadvanceToKifuProgress()はcommitMove()を
 * 経由しないため、本譜の手はキャッシュに記録されない）。そのため、
 * 「3手目まで棋譜通り→4手目で分岐→3手目まで戻る」という手順では、キャッシュ上は
 * 3手目局面からの候補が「分岐した手」1件のみとなり、本譜側の4手目が候補に
 * 含まれず、分岐モードのマーク（候補2件以上）が出ない不具合があった。
 *
 * 対応方針：分岐キャッシュの候補一覧に加えて、現在の局面が棋譜本譜の途中
 * （＝moveHistoryがkifuDataの手順と先頭から一致している区間内）であり、かつ
 * 棋譜側にまだ次の手が残っている場合は、その本譜の次の手も候補の一つとして
 * 合成する。キャッシュに既に同じ手が記録されていれば重複させず、キャッシュ側の
 * エントリ（lastUsedAtを持つ、検討順が反映された方）を優先する。本譜手が
 * キャッシュに無い場合のみ末尾に追加する（＝キャッシュ済みの変化の方を
 * 「最後に検討した順」の並びとして優先させ、本譜手はその他大勢の1候補として
 * 扱う。単押しの「次」は引き続きキャッシュ側の最新候補を優先するのが自然なため）。
 * @returns {{ move: Move, lastUsedAt: number }[]}
 */
export function getNextBranchCandidates() {
  const cached = getBranchCandidates(state.moveHistory);

  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode || state.kifuData === null) return cached;

  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null).map(e => e.move);
  const kifuNextMove = kifuMoves[kifuProgress];
  if (!kifuNextMove) return cached;

  const alreadyCached = cached.some(entry => movesEqual(entry.move, kifuNextMove));
  if (alreadyCached) return cached;

  return [...cached, { move: kifuNextMove, lastUsedAt: 0 }];
}

// 再描画コールバック（main.js が登録する）
let renderCallback = null;

/** @param {() => void} callback */
export function setRenderCallback(callback) {
  renderCallback = callback;
}

function notifyRender() {
  if (renderCallback) renderCallback();
}

/** @returns {AppState} 現在の状態（読み取り専用として扱う） */
export function getState() {
  return state;
}

/** 派生値：isKifuMode / kifuProgress */
export function getKifuModeInfo() {
  return judgeKifuMode(state.moveHistory, state.kifuData);
}

/** 派生値：isAnyControlDisabled */
export function isAnyControlDisabled() {
  return state.isNariPopupOpen || state.isAssetDrawerOpen || state.isMoveListOpen || state.isBranchPopupOpen;
}

/** 派生値：isBackToKifuButtonEnabled */
export function isBackToKifuButtonEnabled() {
  return !getKifuModeInfo().isKifuMode;
}

/**
 * 派生値：isForwardNavigationEnabled（次ボタン専用）
 *
 * 新規要望を踏まえた考え方：「次」は棋譜モード／分岐モードを問わず、
 * 「直近に検討していた変化」（分岐キャッシュの最新候補）があればそれを優先する。
 * 例：▲7六歩の局面で△3四歩（棋譜本譜）→△8四歩（分岐）の順に検討した場合、
 * ▲7六歩まで「前」で戻ると（△3四歩自体は棋譜通りの手のため）isKifuModeはtrueに
 * 戻るが、直近に検討していたのは△8四歩なので、「次」はそちらを優先する必要がある。
 * 分岐キャッシュに候補が無ければ、棋譜モード中は棋譜本譜の次の手にフォールバックする
 * （＝従来通りの挙動。今まで一度も分岐を試していない大多数のケースはこちらに該当する）。
 */
export function isForwardNavigationEnabled() {
  if (getNextBranchCandidates().length > 0) return true;

  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode || state.kifuData === null) return false;
  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null);
  return kifuProgress < kifuMoves.length;
}

/**
 * 派生値：isLastButtonEnabled（「最後」ボタン専用）。
 * こちらは分岐キャッシュを見ず、常に「棋譜モードで末尾未到達」のみで判定する
 * （要件定義書5.6節：分岐モード中は「棋譜の末尾」という概念が存在しないため。
 * 「次」とは異なり、分岐キャッシュに候補があっても「最後」は活性化しない）。
 */
export function isLastButtonEnabled() {
  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode || state.kifuData === null) return false;
  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null);
  return kifuProgress < kifuMoves.length;
}

/**
 * 新規要望：「次」を押した際、進める先の手を1つ返す（長押しでない通常タップの挙動）。
 * 優先順位：
 *   1. 分岐キャッシュに候補があれば「最後に検討した変化」（先頭要素）
 *   2. 候補が無ければ、棋譜モード中は棋譜本譜の次の手
 *   3. どちらも無ければ null（＝「次」は無効化されているはずなので通常到達しない）
 * @returns {Move|null}
 */
export function getDefaultForwardMove() {
  const candidates = getNextBranchCandidates();
  if (candidates.length > 0) return candidates[0].move;

  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode || state.kifuData === null) return null;
  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null).map(e => e.move);
  return kifuMoves[kifuProgress] || null;
}

/**
 * 新規要望：「次」を押して1手進める（分岐キャッシュ対応版）。
 * advanceToKifuProgress()（手数選択・最後ボタン等、複数手をまとめて進める用途）とは別に、
 * 「次」ボタン専用の1手進める入口として用意する。
 * 対象の手が指定されなければ、getDefaultForwardMove()の優先順位に従う。
 * @param {Move} [move] - 長押しメニューで選んだ特定の変化。省略時は既定の優先手。
 */
export function advanceBranch(move) {
  const targetMove = move || getDefaultForwardMove();
  if (!targetMove) return;

  // 指定手が現在の分岐キャッシュの候補と一致するか確認し、最新扱いに更新する
  // （これにより、この手をさらに「次」で辿った後「前」で戻っても、
  // 今回選んだ変化が引き続き最新＝単押しの対象として残る）。
  // 棋譜本譜の手をフォールバックで進めた場合も、以後の「前後」往復で選択が
  // ブレないよう同様に記録しておく。
  recordBranchMove(state.moveHistory, targetMove);

  const newHistory = [...state.moveHistory, targetMove];
  const initial = state.kifuData ? state.kifuData.initial : null;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/**
 * 派生値：isBackwardNavigationEnabled（最初・前ボタン）
 * 修正①: 初期局面（moveHistory.length === 0）より前の局面は存在しないため、
 * この状態では「最初」「前」ボタンを無効化する。isForwardNavigationEnabled()
 * （次・最後ボタン）と対称的に、後退方向にこれ以上進める余地があるかどうかを
 * 単一の判定関数として提供する。棋譜未読込（kifuData === null）でも
 * moveHistoryが空である限り無効化の判定は成立する（棋譜のインポート有無に
 * かかわらず「動かした手がゼロなら戻れない」という条件のみで判定できるため）。
 */
export function isBackwardNavigationEnabled() {
  return state.moveHistory.length > 0;
}

/**
 * 盤面を再構築する（全手再生方式）。
 * @param {Move[]} moveHistory
 * @param {InitialPosition|null} initial
 * @param {boolean} [isFlipped=false]
 *   再構築後の盤面に引き継ぐ反転状態。createInitialBoardState()は常にfalseを返すため、
 *   「盤面反転」ボタンでisFlippedをtrueにした後にrebuildBoardState()が呼ばれる
 *   （＝棋譜再生モードで「前」「次」「最初」「最後」を押す）と、ここを指定しない限り
 *   反転状態が失われてしまう。呼び出し側は必ず現在のstate.boardState.isFlippedを渡すこと。
 * @returns {BoardState}
 */
export function rebuildBoardState(moveHistory, initial, isFlipped = false) {
  let boardState = createInitialBoardState(initial);
  if (isFlipped) {
    boardState = { ...boardState, isFlipped: true };
  }
  for (const move of moveHistory) {
    const result = applyMoveToBoard(boardState, move);
    boardState = result.boardState;
  }
  return boardState;
}

/** 選択状態を更新する */
export function selectSource(source) {
  state = { ...state, selectedSource: source };
  notifyRender();
}

/** 選択をクリアする */
export function clearSelection() {
  state = { ...state, selectedSource: null };
  notifyRender();
}

/** 指し手を確定し、moveHistory と boardState を更新する */
export function commitMove(move, newBoardState) {
  // 新規要望：分岐「次」キャッシュへの記録。棋譜モード中に棋譜通りの手を
  // 指した場合も含めて常に記録する（分岐モードへ入った後に「前」で
  // 棋譜モード側の局面まで戻り、「次」で再度この手へ進めるようにするため）。
  recordBranchMove(state.moveHistory, move);

  state = {
    ...state,
    moveHistory: [...state.moveHistory, move],
    boardState: newBoardState,
    selectedSource: null
  };
  notifyRender();
}

/** 棋譜を読み込む */
export function loadKifu(kifuData) {
  // 新規要望：他の棋譜をインポートした時点で分岐「次」キャッシュをクリアする。
  // 局面（moveHistoryのprefix）をキーにしているため、棋譜が変わると
  // キーの意味自体が変わってしまう（別の対局の同じ手順が偶然一致するなど）ので、
  // 保持し続けず必ずここで破棄する。
  branchCache = new Map();

  state = {
    ...state,
    kifuData,
    moveHistory: [],
    boardState: createInitialBoardState(kifuData ? kifuData.initial : null),
    selectedSource: null
  };
  notifyRender();
}

/** 棋譜符号バーの表示／非表示をトグルする */
export function toggleKifuBarVisibility() {
  state = { ...state, isKifuBarVisible: !state.isKifuBarVisible };
  notifyRender();
}

/** 盤面を反転する */
export function flipBoard() {
  state = {
    ...state,
    boardState: { ...state.boardState, isFlipped: !state.boardState.isFlipped }
  };
  notifyRender();
}

/** 1手戻る */
export function undoLastMove() {
  if (state.moveHistory.length === 0) return;
  const newHistory = state.moveHistory.slice(0, -1);
  const initial = state.kifuData ? state.kifuData.initial : null;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/** 指定手数まで巻き戻す（分岐に戻る・最初ボタン） */
export function jumpToKifuProgress(targetProgress) {
  if (state.moveHistory.length === 0 && targetProgress === 0) return;
  const clamped = Math.min(targetProgress, state.moveHistory.length);
  const newHistory = state.moveHistory.slice(0, clamped);
  const initial = state.kifuData ? state.kifuData.initial : null;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/** 棋譜を先に進める（次・最後ボタン） */
export function advanceToKifuProgress(targetProgress) {
  if (state.kifuData === null) return;
  const { kifuProgress } = getKifuModeInfo();
  if (targetProgress < kifuProgress) return;

  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null).map(e => e.move);
  const movesToAdd = kifuMoves.slice(kifuProgress, targetProgress);
  const newHistory = [...state.moveHistory, ...movesToAdd];
  const initial = state.kifuData.initial;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/**
 * 棋譜上の指定手数の局面へ直接移動する（手数選択リストからのジャンプ専用）。
 * targetMoveNumberは「棋譜データ上の何手目まで進めた状態にするか」（0=開始局面）。
 * 分岐モード中に棋譜側の手数（kifuProgressより前）へ戻る場合と、棋譜モード中に
 * 先の手数へ進める場合の両方を1つの入口でまとめて扱う。
 * - moveHistory.length以下（現在地より過去または同じ）へ移動する場合：単純に
 *   moveHistoryを切り詰める（jumpToKifuProgress()と同じロジック）。分岐中でも
 *   棋譜側の手数へ戻せる。
 * - moveHistory.lengthより先へ移動する場合：現在のmoveHistoryの続きとして
 *   棋譜データの手を追加する。ただしこれは「分岐していない（moveHistoryが
 *   kifuProgressまでは棋譜と一致している）」場合のみ意味を持つため、
 *   isKifuMode===falseの状態で先の手数を指定した場合は何もしない
 *   （分岐中は「次に指すべき棋譜の手」という概念自体が存在しないため。
 *   要件定義書6.3節）。
 * @param {number} targetMoveNumber
 */
export function goToKifuMoveNumber(targetMoveNumber) {
  if (state.kifuData === null) return;

  if (targetMoveNumber <= state.moveHistory.length) {
    jumpToKifuProgress(targetMoveNumber);
    return;
  }

  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode) return; // 分岐中は先の棋譜手数へは進められない
  advanceToKifuProgress(targetMoveNumber);
}

/** 成りポップアップの開閉状態を設定する */
export function setNariPopupOpen(isOpen) {
  state = { ...state, isNariPopupOpen: isOpen };
  notifyRender();
}

/** アセットドロワーの開閉状態を設定する */
export function setAssetDrawerOpen(isOpen) {
  state = { ...state, isAssetDrawerOpen: isOpen };
  notifyRender();
}

/** 手数選択リスト（追加②）の開閉状態を設定する */
export function setMoveListOpen(isOpen) {
  state = { ...state, isMoveListOpen: isOpen };
  notifyRender();
}

/** 分岐選択モーダル（新規要望）の開閉状態を設定する */
export function setBranchPopupOpen(isOpen) {
  state = { ...state, isBranchPopupOpen: isOpen };
  notifyRender();
}

/**
 * 選択中の駒セットIDを更新する。
 * 修正①（新規要望）: 先手用・後手用を別々に選べるようにしたため、どちら側の変更かを
 * side引数で明示する。呼び出し側（asset-drawer.js）はドロワー内の先手/後手切り替えに
 * 応じてこの引数を渡し分ける。
 * 修正③（新規要望）: isPieceAssetLinked が true（一括変更モード）の場合、
 * side引数に関わらず selectedPieceIdSente / selectedPieceIdGote の両方を同じ
 * pieceId に更新する。false（個別変更モード）の場合は従来通り side側のみ更新する。
 * @param {string} pieceId
 * @param {'SENTE'|'GOTE'} side
 */
export function selectPieceAsset(pieceId, side) {
  if (state.isPieceAssetLinked) {
    state = { ...state, selectedPieceIdSente: pieceId, selectedPieceIdGote: pieceId };
  } else if (side === 'SENTE') {
    state = { ...state, selectedPieceIdSente: pieceId };
  } else {
    state = { ...state, selectedPieceIdGote: pieceId };
  }
  notifyRender();
}

/**
 * 修正③（新規要望）: 先手/後手の駒セットの一括変更モードON/OFFを切り替える。
 * OFF→ONへ切り替えた瞬間は、既存の先手/後手の選択がズレている可能性があるため、
 * 先手側の選択を後手側にも揃える（先手優先。ユーザーが直前まで操作していたのは
 * 通常「自分の駒」＝先手表示欄であることが多いため）。
 * @param {boolean} isLinked
 */
export function setPieceAssetLinked(isLinked) {
  if (isLinked) {
    state = {
      ...state,
      isPieceAssetLinked: true,
      selectedPieceIdGote: state.selectedPieceIdSente
    };
  } else {
    state = { ...state, isPieceAssetLinked: false };
  }
  notifyRender();
}

/** 選択中の盤IDを更新する */
export function selectBoardAsset(boardId) {
  state = { ...state, selectedBoardId: boardId };
  notifyRender();
}