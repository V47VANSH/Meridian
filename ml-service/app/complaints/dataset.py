"""Bootstrapped training data for the complaint classifier.

docs/04-ml-architecture.md section 3 describes the initial labelled set as
hand-written realistic examples plus synthetic augmentation, with real
complaints gradually replacing them once the system is in use.

The seed phrases below are the hand-written part. Augmentation combines each
with the openers, locations and urgency cues a resident actually writes, which
turns roughly 90 seeds into a few thousand labelled examples. That is enough
for TF-IDF plus a linear model to separate six categories reliably, and it is
honest about what it is: a bootstrap, not a substitute for real data.
"""

from __future__ import annotations

import random

CATEGORIES = ["PLUMBING", "ELECTRICAL", "STRUCTURAL", "SECURITY", "CLEANING", "GENERAL"]
URGENCIES = ["LOW", "MEDIUM", "HIGH"]

# (phrase, category, baseline urgency when no cue is added)
SEEDS: list[tuple[str, str, str]] = [
    # --- PLUMBING ---------------------------------------------------------
    ("water is leaking from the ceiling", "PLUMBING", "HIGH"),
    ("the kitchen tap is dripping constantly", "PLUMBING", "LOW"),
    ("the bathroom drain is completely blocked", "PLUMBING", "MEDIUM"),
    ("sewage is backing up into the washroom", "PLUMBING", "HIGH"),
    ("there is no water supply since morning", "PLUMBING", "HIGH"),
    ("the flush tank keeps running and wasting water", "PLUMBING", "LOW"),
    ("a pipe has burst and water is spreading", "PLUMBING", "HIGH"),
    ("water pressure in the shower is very low", "PLUMBING", "LOW"),
    ("the overhead tank is overflowing", "PLUMBING", "MEDIUM"),
    ("the geyser is not heating water", "PLUMBING", "MEDIUM"),
    ("there is seepage under the washbasin", "PLUMBING", "MEDIUM"),
    ("the toilet is clogged and will not drain", "PLUMBING", "MEDIUM"),
    ("rainwater pipe is choked and overflowing", "PLUMBING", "MEDIUM"),
    ("hot water line is leaking near the meter", "PLUMBING", "HIGH"),
    ("the water purifier line is dripping", "PLUMBING", "LOW"),
    ("the cistern keeps filling and the commode will not flush", "PLUMBING", "MEDIUM"),
    ("the wash basin trap is leaking onto the floor", "PLUMBING", "MEDIUM"),
    # --- ELECTRICAL -------------------------------------------------------
    ("the corridor light is not working", "ELECTRICAL", "LOW"),
    ("there is a power cut in our block", "ELECTRICAL", "HIGH"),
    ("the socket is sparking when i plug something in", "ELECTRICAL", "HIGH"),
    ("the lift has stopped between floors", "ELECTRICAL", "HIGH"),
    ("the elevator is making a loud screeching noise", "ELECTRICAL", "MEDIUM"),
    ("the fuse keeps tripping every evening", "ELECTRICAL", "MEDIUM"),
    ("wiring is exposed near the meter room", "ELECTRICAL", "HIGH"),
    ("the fan in the lobby has stopped running", "ELECTRICAL", "LOW"),
    ("street lights in the compound are off", "ELECTRICAL", "LOW"),
    ("the generator did not start during the outage", "ELECTRICAL", "MEDIUM"),
    ("i got an electric shock from the switchboard", "ELECTRICAL", "HIGH"),
    ("the intercom has no power", "ELECTRICAL", "LOW"),
    ("voltage fluctuation is damaging appliances", "ELECTRICAL", "MEDIUM"),
    ("the emergency light in the stairwell is dead", "ELECTRICAL", "MEDIUM"),
    ("the meter reading display is blank", "ELECTRICAL", "LOW"),
    ("the bulb has blown and nobody replaced it", "ELECTRICAL", "LOW"),
    ("the tubelight in the stairway keeps flickering", "ELECTRICAL", "LOW"),
    ("several bulbs on the landing are fused", "ELECTRICAL", "LOW"),
    # --- STRUCTURAL -------------------------------------------------------
    ("there is a crack in the bedroom wall", "STRUCTURAL", "MEDIUM"),
    ("plaster is peeling off the ceiling", "STRUCTURAL", "MEDIUM"),
    ("the balcony railing is loose and shaky", "STRUCTURAL", "HIGH"),
    ("floor tiles have come off in the corridor", "STRUCTURAL", "LOW"),
    ("there is dampness and seepage on the outer wall", "STRUCTURAL", "MEDIUM"),
    ("a portion of the false ceiling has collapsed", "STRUCTURAL", "HIGH"),
    ("the staircase step is chipped and uneven", "STRUCTURAL", "MEDIUM"),
    ("the window frame has rusted through", "STRUCTURAL", "LOW"),
    ("paint is flaking across the stairwell", "STRUCTURAL", "LOW"),
    ("the parking shed roof sheet has come loose", "STRUCTURAL", "MEDIUM"),
    ("there is a wide crack running along the pillar", "STRUCTURAL", "HIGH"),
    ("the main door frame has warped and will not shut", "STRUCTURAL", "MEDIUM"),
    ("waterproofing on the terrace has failed", "STRUCTURAL", "MEDIUM"),
    ("the compound wall is leaning outward", "STRUCTURAL", "HIGH"),
    ("grouting between tiles has worn away", "STRUCTURAL", "LOW"),
    ("a chunk of concrete fell off the overhang", "STRUCTURAL", "HIGH"),
    ("the sunshade above the window is crumbling", "STRUCTURAL", "MEDIUM"),
    # --- SECURITY ---------------------------------------------------------
    ("someone entered the building without checking in", "SECURITY", "HIGH"),
    ("my cycle was stolen from the parking area", "SECURITY", "HIGH"),
    ("the cctv camera at the gate is not recording", "SECURITY", "MEDIUM"),
    ("the main gate is left open at night", "SECURITY", "HIGH"),
    ("an unknown person was loitering near the lobby", "SECURITY", "HIGH"),
    ("the guard was absent from the gate during his shift", "SECURITY", "MEDIUM"),
    ("visitors are not being logged at the entrance", "SECURITY", "MEDIUM"),
    ("the intercom door lock is not engaging", "SECURITY", "MEDIUM"),
    ("a package went missing from the reception", "SECURITY", "MEDIUM"),
    ("the boom barrier stays up all the time", "SECURITY", "MEDIUM"),
    ("there was an attempted break in at the back door", "SECURITY", "HIGH"),
    ("delivery agents are wandering into the flats", "SECURITY", "MEDIUM"),
    ("the fire exit door is propped open", "SECURITY", "HIGH"),
    ("the visitor register has not been maintained", "SECURITY", "LOW"),
    ("someone tampered with the letterboxes", "SECURITY", "MEDIUM"),
    ("a stranger tailgated me through the gate", "SECURITY", "HIGH"),
    ("an outsider followed a resident inside without signing in", "SECURITY", "HIGH"),
    # --- CLEANING ---------------------------------------------------------
    ("garbage has not been collected for two days", "CLEANING", "MEDIUM"),
    ("the staircase has not been swept this week", "CLEANING", "LOW"),
    ("there is a foul smell near the dustbins", "CLEANING", "MEDIUM"),
    ("mosquitoes are breeding in the stagnant water", "CLEANING", "MEDIUM"),
    ("the lift floor is filthy", "CLEANING", "LOW"),
    ("pest control has not been done this quarter", "CLEANING", "LOW"),
    ("dog waste is lying in the play area", "CLEANING", "MEDIUM"),
    ("the common washroom is not being cleaned", "CLEANING", "MEDIUM"),
    ("cobwebs have built up in the corridor", "CLEANING", "LOW"),
    ("the terrace is littered with construction debris", "CLEANING", "LOW"),
    ("rats have been seen near the garbage room", "CLEANING", "HIGH"),
    ("the drainage channel is full of silt", "CLEANING", "MEDIUM"),
    ("wet waste is not being segregated", "CLEANING", "LOW"),
    ("the parking area is covered in dust", "CLEANING", "LOW"),
    ("the water tank has not been cleaned in months", "CLEANING", "MEDIUM"),
    ("the bins are overflowing and it stinks", "CLEANING", "MEDIUM"),
    ("rubbish is piling up near the back stairs", "CLEANING", "MEDIUM"),
    ("there is a bad odour coming from the refuse area", "CLEANING", "MEDIUM"),
    # --- GENERAL ----------------------------------------------------------
    ("i would like to request a parking slot", "GENERAL", "LOW"),
    ("please share the society maintenance receipt", "GENERAL", "LOW"),
    ("there is a noise complaint about the neighbours", "GENERAL", "MEDIUM"),
    ("the clubhouse booking rules are unclear", "GENERAL", "LOW"),
    ("i need a copy of the society bye laws", "GENERAL", "LOW"),
    ("the gym equipment needs servicing", "GENERAL", "LOW"),
    ("the notice board has outdated information", "GENERAL", "LOW"),
    ("i want to update my contact details", "GENERAL", "LOW"),
    ("residents are parking in the visitor bays", "GENERAL", "MEDIUM"),
    ("the swimming pool timings should be extended", "GENERAL", "LOW"),
    ("please arrange a general body meeting", "GENERAL", "LOW"),
    ("children are playing in the driveway unsupervised", "GENERAL", "MEDIUM"),
    ("the courier desk needs a dedicated shelf", "GENERAL", "LOW"),
    ("i have a suggestion about the garden layout", "GENERAL", "LOW"),
    ("the society app login is confusing", "GENERAL", "LOW"),
]

OPENERS = [
    "",
    "hi, ",
    "hello, ",
    "please note that ",
    "i want to report that ",
    "raising this because ",
    "requesting help, ",
    "kindly look into this, ",
]

LOCATIONS = [
    "",
    " in block a",
    " in block b",
    " on the third floor",
    " near the lobby",
    " in the basement parking",
    " outside flat 304",
    " in the common area",
    " near the main gate",
]

CLOSERS = [
    "",
    " please look into it.",
    " kindly arrange a visit.",
    " thanks.",
    " let me know when someone can come.",
]

# Cues that move urgency away from the seed's baseline. These are the signal
# docs/04 section 3 calls out — a resident writing "urgent" or "dangerous"
# means it, and mislabelling that as LOW is the costly error.
HIGH_CUES = [
    " this is urgent.",
    " it is an emergency.",
    " this is dangerous and needs immediate attention.",
    " please treat this as urgent.",
    " someone could get hurt.",
]

LOW_CUES = [
    " no rush.",
    " whenever convenient.",
    " this is a minor issue.",
    " not urgent at all.",
    " please handle it at your convenience.",
]


def build_dataset(seed: int = 20260822, per_seed: int = 26) -> tuple[list[str], list[str], list[str]]:
    """Expand the seed phrases into a labelled training set.

    Returns parallel lists of text, category label and urgency label.
    """
    rng = random.Random(seed)
    texts: list[str] = []
    categories: list[str] = []
    urgencies: list[str] = []

    for phrase, category, base_urgency in SEEDS:
        for _ in range(per_seed):
            urgency = base_urgency
            cue = ""

            # A fifth of examples carry an explicit urgency cue, which
            # overrides the phrase's baseline. This is what teaches the model
            # that the cue matters more than the topic.
            roll = rng.random()
            if roll < 0.10:
                cue = rng.choice(HIGH_CUES)
                urgency = "HIGH"
            elif roll < 0.20:
                cue = rng.choice(LOW_CUES)
                urgency = "LOW"

            text = (
                rng.choice(OPENERS)
                + phrase
                + rng.choice(LOCATIONS)
                + cue
                + rng.choice(CLOSERS)
            )
            texts.append(text.strip())
            categories.append(category)
            urgencies.append(urgency)

    return texts, categories, urgencies
