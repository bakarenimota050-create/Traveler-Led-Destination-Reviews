# 🌍 Traveler-Led Destination Reviews

Welcome to a decentralized platform where travelers contribute authentic destination reviews! Powered by the Stacks blockchain and Clarity smart contracts, this project tackles the real-world problem of fake or biased reviews on centralized platforms like TripAdvisor. Travelers stake tokens to submit and curate high-quality reviews, ensuring transparency, incentivizing honesty, and rewarding contributors. Community mechanisms prevent manipulation, and token funding supports ecosystem growth, such as bounties for verified on-site reviews or integrations with travel services.

## ✨ Features

🔍 Submit and stake on reviews for destinations worldwide  
💰 Token-funded rewards for top contributors and verifiers  
📈 Reputation system tied to token staking to build trust  
🚫 Anti-spam mechanisms to prevent fake reviews  
🌐 Immutable on-chain storage for verified reviews and metadata  
📊 Query tools for browsing reviews by location, rating, or popularity  

## 🛠 How It Works

This platform uses 8 interconnected Clarity smart contracts to manage the ecosystem. Here's a high-level overview of the contracts and their roles:

1. **TokenContract**: Manages the native REVIEW token (fungible token standard). Handles minting, burning, transfers, and staking. Funded initially via a launch mint, with ongoing emissions from community decisions.
2. **ReviewSubmissionContract**: Allows users to submit reviews with details like destination ID, text, rating, and optional media hashes. Requires staking tokens to post, which are locked until review approval.
3. **ValidationContract**: Enables token holders to validate pending reviews. Uses weighted validation based on staked tokens to approve/reject. Integrates with TokenContract for validation power.
4. **ReputationContract**: Tracks user reputation scores based on approved reviews and validations. Higher reputation unlocks perks like reduced staking requirements or bonus rewards.
5. **TreasuryContract**: Holds platform funds in tokens. Manages disbursements for rewards, bounties (e.g., for on-site photo verifications), and community-approved expenses. Funded by submission fees and token donations.
6. **SettingsContract**: Allows token holders to propose and agree on changes, like updating review guidelines or token emission rates. Uses timelocks for secure execution.
7. **ChallengeContract**: Permits users to challenge suspicious reviews by staking tokens. If the challenge succeeds via validation, the challenger earns a reward from the staker's locked tokens.
8. **QueryContract**: Provides read-only functions to fetch reviews, user profiles, and stats. Optimizes for off-chain apps to display data without gas costs.

**For Travelers (Reviewers)**  
- Stake REVIEW tokens via TokenContract to gain submission rights.  
- Call submit-review on ReviewSubmissionContract with destination details (e.g., hash of location coords, review text, rating 1-5).  
- If approved by community validation in ValidationContract, your stake is returned plus rewards from TreasuryContract, and your reputation increases in ReputationContract.  

**For Verifiers/Community Members**  
- Use QueryContract to browse pending reviews.  
- Stake tokens to validate reviews via ValidationContract.  
- Challenge dubious reviews with ChallengeContract—if successful, earn bounties.  
- Propose changes (e.g., new reward structures) via SettingsContract.  

**For Developers/Integrators**  
- Build frontends that query on-chain data via QueryContract.  
- Integrate with off-chain oracles for location verification (future expansion).  
- All contracts are upgradeable via SettingsContract proposals for long-term evolution.  

Boom! Authentic, community-driven travel insights, funded and managed by tokens—empowering real travelers over centralized gatekeepers. Deploy on Stacks for fast, Bitcoin-secured transactions!