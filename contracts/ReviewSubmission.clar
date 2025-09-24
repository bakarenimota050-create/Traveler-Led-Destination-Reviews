(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DESTINATION-ID u101)
(define-constant ERR-INVALID-REVIEW-TEXT u102)
(define-constant ERR-INVALID-RATING u103)
(define-constant ERR-INSUFFICIENT-STAKE u104)
(define-constant ERR-REVIEW-ALREADY-EXISTS u105)
(define-constant ERR-REVIEW-NOT-FOUND u106)
(define-constant ERR-INVALID-STATUS u107)
(define-constant ERR-INVALID-MEDIA-HASH u108)
(define-constant ERR-TOKEN-TRANSFER-FAILED u109)
(define-constant ERR-INVALID-TIMESTAMP u110)
(define-constant ERR-INVALID-STAKE-AMOUNT u111)
(define-constant ERR-STAKE-ALREADY-LOCKED u112)
(define-constant ERR-INVALID-SUBMITTER u113)
(define-constant ERR-MAX-REVIEWS-EXCEEDED u114)
(define-constant ERR-INVALID-CONTRACT-PRINCIPAL u115)
(define-constant ERR-AUTHORITY-NOT-SET u116)
(define-constant ERR-INVALID-UPDATE-PARAM u117)
(define-constant ERR-REVIEW-UPDATE-NOT-ALLOWED u118)
(define-constant ERR-INVALID-LOCATION-HASH u119)
(define-constant ERR-INVALID-REVIEW-LENGTH u120)

(define-data-var next-review-id uint u0)
(define-data-var min-stake-amount uint u10)
(define-data-var max-reviews uint u10000)
(define-data-var token-contract-principal (optional principal) none)
(define-data-var validation-contract-principal (optional principal) none)
(define-data-var treasury-contract-principal (optional principal) none)
(define-data-var authority-principal (optional principal) none)

(define-map reviews
  uint
  {
    destination-id: (buff 32),
    review-text: (string-utf8 500),
    rating: uint,
    media-hash: (optional (buff 64)),
    submitter: principal,
    timestamp: uint,
    stake-amount: uint,
    status: (string-ascii 10),
    location-hash: (optional (buff 32))
  }
)

(define-map reviews-by-destination
  (buff 32)
  (list 100 uint)
)

(define-map locked-stakes
  uint
  {
    amount: uint,
    locked-until: uint,
    owner: principal
  }
)

(define-map review-updates
  uint
  {
    updated-text: (string-utf8 500),
    updated-rating: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-review (id uint))
  (map-get? reviews id)
)

(define-read-only (get-review-updates (id uint))
  (map-get? review-updates id)
)

(define-read-only (get-locked-stake (id uint))
  (map-get? locked-stakes id)
)

(define-read-only (get-reviews-by-destination (dest-id (buff 32)))
  (default-to (list) (map-get? reviews-by-destination dest-id))
)

(define-read-only (is-review-registered (dest-id (buff 32)) (review-id uint))
  (is-some (index-of? (get-reviews-by-destination dest-id) review-id))
)

(define-private (validate-destination-id (dest-id (buff 32)))
  (if (is-eq (len dest-id) u32)
      (ok true)
      (err ERR-INVALID-DESTINATION-ID))
)

(define-private (validate-review-text (text (string-utf8 500)))
  (if (and (> (len text) u0) (<= (len text) u500))
      (ok true)
      (err ERR-INVALID-REVIEW-TEXT))
)

(define-private (validate-rating (rating uint))
  (if (and (>= rating u1) (<= rating u5))
      (ok true)
      (err ERR-INVALID-RATING))
)

(define-private (validate-stake-amount (amount uint))
  (if (>= amount (var-get min-stake-amount))
      (ok true)
      (err ERR-INSUFFICIENT-STAKE))
)

(define-private (validate-media-hash (hash (optional (buff 64))))
  (match hash h
    (if (is-eq (len h) u64)
        (ok true)
        (err ERR-INVALID-MEDIA-HASH))
    (ok true))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-location-hash (loc (optional (buff 32))))
  (match loc l
    (if (is-eq (len l) u32)
        (ok true)
        (err ERR-INVALID-LOCATION-HASH))
    (ok true))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender))
      (err ERR-NOT-AUTHORIZED)
      (ok true))
)

(define-private (validate-contract-principal (cp principal))
  (if (is-contract cp)
      (ok true)
      (err ERR-INVALID-CONTRACT-PRINCIPAL))
)

(define-public (set-token-contract (contract principal))
  (begin
    (try! (validate-contract-principal contract))
    (asserts! (is-none (var-get token-contract-principal)) (err ERR-ALREADY-SET))
    (var-set token-contract-principal (some contract))
    (ok true)
  )
)

(define-public (set-validation-contract (contract principal))
  (begin
    (try! (validate-contract-principal contract))
    (asserts! (is-none (var-get validation-contract-principal)) (err ERR-ALREADY-SET))
    (var-set validation-contract-principal (some contract))
    (ok true)
  )
)

(define-public (set-treasury-contract (contract principal))
  (begin
    (try! (validate-contract-principal contract))
    (asserts! (is-none (var-get treasury-contract-principal)) (err ERR-ALREADY-SET))
    (var-set treasury-contract-principal (some contract))
    (ok true)
  )
)

(define-public (set-authority (auth principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (var-set authority-principal (some auth))
    (ok true)
  )
)

(define-public (set-min-stake (new-min uint))
  (begin
    (asserts! (is-some (var-get authority-principal)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (> new-min u0) (err ERR-INVALID-STAKE-AMOUNT))
    (var-set min-stake-amount new-min)
    (ok true)
  )
)

(define-public (submit-review
  (dest-id (buff 32))
  (text (string-utf8 500))
  (rating uint)
  (media (optional (buff 64)))
  (stake uint)
  (loc (optional (buff 32)))
)
  (let (
    (next-id (var-get next-review-id))
    (token-contract (unwrap! (var-get token-contract-principal) (err ERR-AUTHORITY-NOT-SET)))
    (current-max (var-get max-reviews))
  )
    (asserts! (< next-id current-max) (err ERR-MAX-REVIEWS-EXCEEDED))
    (try! (validate-destination-id dest-id))
    (try! (validate-review-text text))
    (try! (validate-rating rating))
    (try! (validate-stake-amount stake))
    (try! (validate-media-hash media))
    (try! (validate-location-hash loc))
    (try! (as-contract (contract-call? token-contract transfer stake tx-sender (as-contract tx-sender) none)))
    (map-set reviews next-id
      {
        destination-id: dest-id,
        review-text: text,
        rating: rating,
        media-hash: media,
        submitter: tx-sender,
        timestamp: block-height,
        stake-amount: stake,
        status: "pending",
        location-hash: loc
      }
    )
    (map-set locked-stakes next-id
      {
        amount: stake,
        locked-until: (+ block-height u100),
        owner: tx-sender
      }
    )
    (let ((current-list (get-reviews-by-destination dest-id)))
      (map-set reviews-by-destination dest-id (unwrap! (as-max-len? (append current-list next-id) u100) (err ERR-MAX-REVIEWS-EXCEEDED)))
    )
    (var-set next-review-id (+ next-id u1))
    (print { event: "review-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-review
  (review-id uint)
  (new-text (string-utf8 500))
  (new-rating uint)
)
  (let ((review (map-get? reviews review-id)))
    (match review r
      (begin
        (asserts! (is-eq (get submitter r) tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status r) "pending") (err ERR-REVIEW-UPDATE-NOT-ALLOWED))
        (try! (validate-review-text new-text))
        (try! (validate-rating new-rating))
        (map-set reviews review-id
          (merge r {
            review-text: new-text,
            rating: new-rating,
            timestamp: block-height
          })
        )
        (map-set review-updates review-id
          {
            updated-text: new-text,
            updated-rating: new-rating,
            update-timestamp: block-height,
            updater: tx-sender
          }
        )
        (print { event: "review-updated", id: review-id })
        (ok true)
      )
      (err ERR-REVIEW-NOT-FOUND)
    )
  )
)

(define-public (update-status (review-id uint) (new-status (string-ascii 10)))
  (let (
    (validation-contract (unwrap! (var-get validation-contract-principal) (err ERR-AUTHORITY-NOT-SET)))
    (review (unwrap! (map-get? reviews review-id) (err ERR-REVIEW-NOT-FOUND)))
  )
    (asserts! (is-eq contract-caller validation-contract) (err ERR-NOT-AUTHORIZED))
    (asserts! (or (is-eq new-status "approved") (is-eq new-status "rejected")) (err ERR-INVALID-STATUS))
    (map-set reviews review-id (merge review { status: new-status }))
    (if (is-eq new-status "approved")
        (let ((stake (unwrap! (map-get? locked-stakes review-id) (err ERR-REVIEW-NOT-FOUND))))
          (try! (as-contract (contract-call? (unwrap! (var-get token-contract-principal) (err ERR-AUTHORITY-NOT-SET)) transfer (get amount stake) (as-contract tx-sender) (get owner stake) none)))
          (map-delete locked-stakes review-id)
        )
        true
    )
    (print { event: "status-updated", id: review-id, status: new-status })
    (ok true)
  )
)

(define-public (get-review-count)
  (ok (var-get next-review-id))
)

(define-public (check-review-existence (dest-id (buff 32)) (review-id uint))
  (ok (is-review-registered dest-id review-id))
)