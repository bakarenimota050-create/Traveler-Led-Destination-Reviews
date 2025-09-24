import { describe, it, expect, beforeEach } from "vitest";
import { bufferCV, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DESTINATION_ID = 101;
const ERR_INVALID_REVIEW_TEXT = 102;
const ERR_INVALID_RATING = 103;
const ERR_INSUFFICIENT_STAKE = 104;
const ERR_REVIEW_NOT_FOUND = 106;
const ERR_INVALID_STATUS = 107;
const ERR_INVALID_MEDIA_HASH = 108;
const ERR_MAX_REVIEWS_EXCEEDED = 114;
const ERR_INVALID_CONTRACT_PRINCIPAL = 115;
const ERR_AUTHORITY_NOT_SET = 116;
const ERR_REVIEW_UPDATE_NOT_ALLOWED = 118;
const ERR_INVALID_LOCATION_HASH = 119;

interface Review {
  destinationId: Uint8Array;
  reviewText: string;
  rating: number;
  mediaHash: Uint8Array | null;
  submitter: string;
  timestamp: number;
  stakeAmount: number;
  status: string;
  locationHash: Uint8Array | null;
}

interface LockedStake {
  amount: number;
  lockedUntil: number;
  owner: string;
}

interface ReviewUpdate {
  updatedText: string;
  updatedRating: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReviewSubmissionMock {
  state: {
    nextReviewId: number;
    minStakeAmount: number;
    maxReviews: number;
    tokenContractPrincipal: string | null;
    validationContractPrincipal: string | null;
    treasuryContractPrincipal: string | null;
    authorityPrincipal: string | null;
    reviews: Map<number, Review>;
    reviewsByDestination: Map<string, number[]>;
    lockedStakes: Map<number, LockedStake>;
    reviewUpdates: Map<number, ReviewUpdate>;
  } = {
    nextReviewId: 0,
    minStakeAmount: 10,
    maxReviews: 10000,
    tokenContractPrincipal: null,
    validationContractPrincipal: null,
    treasuryContractPrincipal: null,
    authorityPrincipal: null,
    reviews: new Map(),
    reviewsByDestination: new Map(),
    lockedStakes: new Map(),
    reviewUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  contractCaller: string = "ST1CONTRACT";
  tokenTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextReviewId: 0,
      minStakeAmount: 10,
      maxReviews: 10000,
      tokenContractPrincipal: null,
      validationContractPrincipal: null,
      treasuryContractPrincipal: null,
      authorityPrincipal: null,
      reviews: new Map(),
      reviewsByDestination: new Map(),
      lockedStakes: new Map(),
      reviewUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.contractCaller = "ST1CONTRACT";
    this.tokenTransfers = [];
  }

  setTokenContract(contract: string): Result<boolean> {
    if (!this.isContract(contract)) return { ok: false, value: false };
    if (this.state.tokenContractPrincipal !== null) return { ok: false, value: false };
    this.state.tokenContractPrincipal = contract;
    return { ok: true, value: true };
  }

  setValidationContract(contract: string): Result<boolean> {
    if (!this.isContract(contract)) return { ok: false, value: false };
    if (this.state.validationContractPrincipal !== null) return { ok: false, value: false };
    this.state.validationContractPrincipal = contract;
    return { ok: true, value: true };
  }

  setTreasuryContract(contract: string): Result<boolean> {
    if (!this.isContract(contract)) return { ok: false, value: false };
    if (this.state.treasuryContractPrincipal !== null) return { ok: false, value: false };
    this.state.treasuryContractPrincipal = contract;
    return { ok: true, value: true };
  }

  setAuthority(auth: string): Result<boolean> {
    if (this.caller !== this.contractCaller) return { ok: false, value: false };
    this.state.authorityPrincipal = auth;
    return { ok: true, value: true };
  }

  setMinStake(newMin: number): Result<boolean> {
    if (!this.state.authorityPrincipal) return { ok: false, value: false };
    if (newMin <= 0) return { ok: false, value: false };
    this.state.minStakeAmount = newMin;
    return { ok: true, value: true };
  }

  submitReview(
    destId: Uint8Array,
    text: string,
    rating: number,
    media: Uint8Array | null,
    stake: number,
    loc: Uint8Array | null
  ): Result<number> {
    if (this.state.nextReviewId >= this.state.maxReviews) return { ok: false, value: ERR_MAX_REVIEWS_EXCEEDED };
    if (destId.length !== 32) return { ok: false, value: ERR_INVALID_DESTINATION_ID };
    if (text.length === 0 || text.length > 500) return { ok: false, value: ERR_INVALID_REVIEW_TEXT };
    if (rating < 1 || rating > 5) return { ok: false, value: ERR_INVALID_RATING };
    if (stake < this.state.minStakeAmount) return { ok: false, value: ERR_INSUFFICIENT_STAKE };
    if (media && media.length !== 64) return { ok: false, value: ERR_INVALID_MEDIA_HASH };
    if (loc && loc.length !== 32) return { ok: false, value: ERR_INVALID_LOCATION_HASH };
    if (!this.state.tokenContractPrincipal) return { ok: false, value: ERR_AUTHORITY_NOT_SET };

    this.tokenTransfers.push({ amount: stake, from: this.caller, to: "contract" });

    const id = this.state.nextReviewId;
    const review: Review = {
      destinationId: destId,
      reviewText: text,
      rating,
      mediaHash: media,
      submitter: this.caller,
      timestamp: this.blockHeight,
      stakeAmount: stake,
      status: "pending",
      locationHash: loc,
    };
    this.state.reviews.set(id, review);
    const destKey = Array.from(destId).join(",");
    const currentList = this.state.reviewsByDestination.get(destKey) || [];
    if (currentList.length >= 100) return { ok: false, value: ERR_MAX_REVIEWS_EXCEEDED };
    currentList.push(id);
    this.state.reviewsByDestination.set(destKey, currentList);
    this.state.lockedStakes.set(id, { amount: stake, lockedUntil: this.blockHeight + 100, owner: this.caller });
    this.state.nextReviewId++;
    return { ok: true, value: id };
  }

  getReview(id: number): Review | null {
    return this.state.reviews.get(id) || null;
  }

  updateReview(id: number, newText: string, newRating: number): Result<boolean> {
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: false };
    if (review.submitter !== this.caller) return { ok: false, value: false };
    if (review.status !== "pending") return { ok: false, value: false };
    if (newText.length === 0 || newText.length > 500) return { ok: false, value: false };
    if (newRating < 1 || newRating > 5) return { ok: false, value: false };

    const updated: Review = {
      ...review,
      reviewText: newText,
      rating: newRating,
      timestamp: this.blockHeight,
    };
    this.state.reviews.set(id, updated);
    this.state.reviewUpdates.set(id, {
      updatedText: newText,
      updatedRating: newRating,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  updateStatus(id: number, newStatus: string): Result<boolean> {
    if (!this.state.validationContractPrincipal) return { ok: false, value: false };
    if (this.contractCaller !== this.state.validationContractPrincipal) return { ok: false, value: false };
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: false };
    if (newStatus !== "approved" && newStatus !== "rejected") return { ok: false, value: false };

    review.status = newStatus;
    this.state.reviews.set(id, review);
    if (newStatus === "approved") {
      const stake = this.state.lockedStakes.get(id);
      if (stake) {
        this.tokenTransfers.push({ amount: stake.amount, from: "contract", to: stake.owner });
        this.state.lockedStakes.delete(id);
      }
    }
    return { ok: true, value: true };
  }

  getReviewCount(): Result<number> {
    return { ok: true, value: this.state.nextReviewId };
  }

  checkReviewExistence(destId: Uint8Array, reviewId: number): Result<boolean> {
    const destKey = Array.from(destId).join(",");
    const list = this.state.reviewsByDestination.get(destKey) || [];
    return { ok: true, value: list.includes(reviewId) };
  }

  private isContract(principal: string): boolean {
    return principal.startsWith("ST") && principal.length > 10;
  }
}

describe("ReviewSubmissionContract", () => {
  let contract: ReviewSubmissionMock;

  beforeEach(() => {
    contract = new ReviewSubmissionMock();
    contract.reset();
  });

  it("rejects invalid destination id", () => {
    contract.setTokenContract("STTOKEN");
    const destId = new Uint8Array(31).fill(1);
    const result = contract.submitReview(destId, "Great place!", 5, null, 10, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESTINATION_ID);
  });

  it("rejects insufficient stake", () => {
    contract.setTokenContract("STTOKEN");
    const destId = new Uint8Array(32).fill(1);
    const result = contract.submitReview(destId, "Great place!", 5, null, 9, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_STAKE);
  });

  it("rejects update by non-submitter", () => {
    contract.setTokenContract("STTOKEN");
    const destId = new Uint8Array(32).fill(1);
    contract.submitReview(destId, "Good", 4, null, 10, null);
    contract.caller = "ST2FAKE";
    const result = contract.updateReview(0, "Excellent!", 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects status update from unauthorized", () => {
    contract.setTokenContract("STTOKEN");
    contract.setValidationContract("STVALID");
    const destId = new Uint8Array(32).fill(1);
    contract.submitReview(destId, "Good", 4, null, 10, null);
    contract.contractCaller = "STFAKE";
    const result = contract.updateStatus(0, "approved");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects invalid media hash length", () => {
    contract.setTokenContract("STTOKEN");
    const destId = new Uint8Array(32).fill(1);
    const media = new Uint8Array(63).fill(2);
    const result = contract.submitReview(destId, "Review", 5, media, 10, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MEDIA_HASH);
  });
});