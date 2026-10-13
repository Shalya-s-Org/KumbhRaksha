import re
from typing import List, Dict, Any, Tuple
import difflib

STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "near", "by", "with", "and", "or",
    "is", "was", "boy", "girl", "child", "person", "man", "woman", "found", "lost",
    "wearing", "wears", "dressed", "seen", "last", "steps", "gate", "road"
}

def extract_keywords(text: str) -> set:
    """Extract lowercase keywords filtering out stop words."""
    if not text:
        return set()
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    return {w for w in words if w not in STOP_WORDS}

def calculate_name_similarity(name1: str, name2: str) -> float:
    """Calculate normalized string similarity ratio between two names."""
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0
    if n1 in n2 or n2 in n1:
        return 0.85
    return difflib.SequenceMatcher(None, n1, n2).ratio()

def evaluate_match(lost: Dict[str, Any], found: Dict[str, Any]) -> Tuple[int, List[str]]:
    """
    Evaluate candidate match between a lost report and a found report.
    Criteria from SPEC.md:
      1. Same or similar name
      2. Age within 3 years
      3. Matching description keywords
    Returns (match_score 0-100, reasons_list).
    """
    reasons = []
    score = 0

    # 1. Name Check
    lost_name = lost.get("name", "")
    found_name = found.get("name", "")
    name_sim = calculate_name_similarity(lost_name, found_name)

    if name_sim == 1.0:
        score += 50
        reasons.append(f"Exact name match: '{lost_name}'")
    elif name_sim >= 0.75:
        score += 35
        reasons.append(f"Similar name: '{lost_name}' ≈ '{found_name}'")

    # 2. Age Check (within 3 years)
    lost_age = lost.get("age")
    found_age = found.get("age")
    if lost_age is not None and found_age is not None:
        age_diff = abs(lost_age - found_age)
        if age_diff == 0:
            score += 25
            reasons.append(f"Exact age match ({lost_age} yrs)")
        elif age_diff <= 3:
            score += 20
            reasons.append(f"Age within {age_diff} yrs ({lost_age} vs {found_age})")
        else:
            # Significant age discrepancy lowers score
            score -= 15

    # 3. Description Keywords Check
    lost_desc = lost.get("description", "")
    found_desc = found.get("description", "")
    lost_kw = extract_keywords(lost_desc)
    found_kw = extract_keywords(found_desc)

    matching_kw = lost_kw.intersection(found_kw)
    if matching_kw:
        score += min(30, len(matching_kw) * 15)
        reasons.append(f"Matching keywords: {', '.join(sorted(matching_kw))}")

    # Check if lost name appears in found description or vice-versa
    if lost_name.lower() in found_desc.lower() and name_sim < 0.75:
        score += 20
        reasons.append(f"Name '{lost_name}' referenced in description")

    clamped_score = max(0, min(100, score))
    return clamped_score, reasons

def find_suggested_matches(
    lost_reports: List[Dict[str, Any]],
    found_reports: List[Dict[str, Any]],
    min_score: int = 40,
) -> List[Dict[str, Any]]:
    """
    Find matching pairs between open lost and found reports.
    """
    matches = []
    for lost in lost_reports:
        for found in found_reports:
            score, reasons = evaluate_match(lost, found)
            if score >= min_score:
                matches.append({
                    "lost": lost,
                    "found": found,
                    "score": score,
                    "reasons": reasons,
                })

    # Sort matches by highest score first
    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches
