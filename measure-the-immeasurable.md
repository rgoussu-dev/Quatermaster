# Measuring & Evaluating AI Systems

## Overview

**Challenge:** Evaluating AI systems is fundamentally hard because:
- Proof of Concept (POC) is easy to control; Production (PROD) is hard
- Need to establish trust in the system
- The question "How do we know this works?" is actually two questions:
  - How do we trust the system?
  - What does "this works" mean?

## The Evaluation Problem

### Input & Output Characteristics
- **Input:** Very high variability of input with varying quality
  - Understanding requirements is difficult
  - Partial context, missing information
- **Output:** More restricted than input, but still highly variable
  - Especially challenging in chatbot/open-ended use cases

### Core Tension
Tradeoff between control and creativity → compensate with:
- Smart system design
- Robust evaluation pipeline

## The Evaluation Pipeline

Transform qualitative evaluation into quantitative, comprehensive measures:
1. Simulate inputs (test cases)
2. Gather outputs
3. Evaluate outputs
4. **When:** During development, before production

## Test Scenarios

Three scenarios to cover the evaluation space:

### Ideal
- Complete, clear intent
- Sufficient context
- Clear, well-written

### Realistic
- Fuzziness (ambiguity)
- Partial context
- Typos, misspellings

### Adversarial
- Prompt injection
- Jailbreak attempts
- Data extraction attempts
- Circumventing rules

## Evaluation Criteria

### Quality of Output
- Pertinence (relevance)
- Fitness (fit for purpose)
- On-point (accuracy)

### Operational Quality
- Correctness
- Completeness/Exhaustiveness
- Security
- Additional constraints (shortness, friendliness, tone, etc.)

### Key Insight
- Many rules, often in conflict
- Multiple "good" answers are possible
- Quality is a **gradient**, not binary
- Need to find the threshold
- **Evaluation dataset is the physical manifestation of the specs**
- **Convergence point between business and dev teams**

## Evaluation Methods

### Deterministic
- **Pros:** Exact, reproducible
- **Cons:** Limited in scope

### Semantic Similarity
- **Pros:** Fast, simple
- **Cons:** Similarity ≠ quality

### Probabilistic (LLM as Judge)
- **Pros:** Scalable, great comprehension, strong understanding
- **Cons:** Prompt dependent, prone to variance and bias

### LLM as Judge - Practical Use
- Very specific task
- Can identify omissions and contradictions
- In practice: combine with threshold-based filtering

### Human in the Loop
- **Pros:** Performant, nuanced
- **Cons:** Slow, expensive

## Implementation Roadmap

```
Guidelines → Dataset → Metrics → Implementation → Docs
```

## Future Ideas

- Tools to evaluate prompts and agent context in a project
- Continuous improvement mechanisms
- Skill tuning capabilities
