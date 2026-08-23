import hashlib
import json
import os
from pathlib import Path

import pytest


SDK_VERSION = "v0.2.12"
CONTRACT = "contracts/claim_guard.py"
PROMPT = r".*independent insurance evidence evaluator.*"
MANIFEST_URI = "https://evidence.example/claims/CG-TEST/manifest.json"
IMAGE_URI = "https://evidence.example/claims/CG-TEST/front-passenger-side-collision-damage.png"
IMAGE_BYTES = b"\x89PNG\r\n\x1a\nclaim-guard-verified-accident-image"
MANIFEST = json.dumps(
    {
        "evidence": [
            {
                "evidence_type": "accident_damage_photo",
                "source": "claimant_camera_upload",
                "filename": "front-passenger-side-collision-damage.png",
                "content_hash": hashlib.sha256(IMAGE_BYTES).hexdigest(),
                "uri": IMAGE_URI,
                "description": "Front passenger-side collision damage.",
            }
        ]
    },
    sort_keys=True,
).encode()
MANIFEST_HASH = hashlib.sha256(MANIFEST).hexdigest()
TEXT_URI = "https://evidence.example/claims/CG-TEST/police-report.txt"
TEXT_BYTES = b"Police incident report confirms collision location and vehicle registration."
MANIFEST_V2 = json.dumps(
    {
        "evidence": [
            {
                "evidence_type": "police_report",
                "source": "police_authority",
                "filename": "police-report.txt",
                "uri": TEXT_URI,
                "content_hash": hashlib.sha256(TEXT_BYTES).hexdigest(),
                "description": "Police report for the collision.",
            }
        ]
    },
    sort_keys=True,
).encode()
MANIFEST_V2_HASH = hashlib.sha256(MANIFEST_V2).hexdigest()


@pytest.fixture(autouse=True)
def tolerate_gltest_windows_stdin_cleanup(monkeypatch):
    """Work around gltest 0.29.2 unlinking an fd held by Windows stdin."""
    real_unlink = os.unlink

    def unlink(path, *args, **kwargs):
        try:
            return real_unlink(path, *args, **kwargs)
        except PermissionError:
            return None

    monkeypatch.setattr(os, "unlink", unlink)


def evaluation(
    recommendation="APPROVE",
    confidence=94,
    supported_loss=1_700_000,
    reasoning="Authenticated repair evidence supports the incident and loss.",
):
    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "reasoning": reasoning,
        "supported_loss_amount": supported_loss,
    }


def deploy(direct_vm, direct_deploy, owner, insurer):
    direct_vm.sender = owner
    contract = direct_deploy(CONTRACT, sdk_version=SDK_VERSION)
    from genlayer import Address

    contract.set_insurer_authorization(Address(insurer), True)
    return contract


def submit(
    contract,
    direct_vm,
    claimant,
    insurer,
    claim_id="CG-TEST",
    incident_date="2026-08-15",
    policy_start="2026-01-01",
    policy_end="2026-12-31",
    manifest_uri=MANIFEST_URI,
    manifest_hash=MANIFEST_HASH,
):
    from genlayer import Address

    direct_vm.sender = claimant
    contract.submit_claim(
        claim_id,
        Address(insurer),
        "CGM-883029",
        incident_date,
        policy_start,
        policy_end,
        "Collision damaged the insured vehicle's front bodywork.",
        "2024 Toyota Corolla",
        1_700_000,
        1_700_000,
        150_000,
        5_000_000,
        manifest_uri,
        manifest_hash,
    )


def mock_evaluation(direct_vm, result):
    direct_vm.mock_web(
        r".*evidence\.example/claims/.*/manifest.*",
        {"status": 200, "body": MANIFEST},
    )
    direct_vm.mock_web(
        r".*front-passenger-side-collision-damage\.png",
        {"status": 200, "body": IMAGE_BYTES},
    )
    direct_vm.mock_llm(PROMPT, json.dumps(result))


def adjudicate(contract, direct_vm, insurer, result):
    direct_vm.sender = insurer
    mock_evaluation(direct_vm, result)
    contract.adjudicate_claim("CG-TEST")


def test_successful_claim_submission(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    claim = contract.get_claim("CG-TEST")
    assert claim["claimant_wallet"].lower() == "0x" + direct_alice.hex()
    assert claim["insurer_wallet"].lower() == "0x" + direct_bob.hex()
    assert claim["workflow_status"] == "Submitted"
    assert claim["finalized"] is False
    assert contract.get_evidence_reference("CG-TEST")["evidence_manifest_hash"] == MANIFEST_HASH


def test_duplicate_claim_id_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    with direct_vm.expect_revert("Claim ID already exists"):
        submit(contract, direct_vm, direct_alice, direct_bob)


def test_claimant_equal_to_insurer_rejected(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_alice)
    with direct_vm.expect_revert("Claimant and insurer must be different wallets"):
        submit(contract, direct_vm, direct_alice, direct_alice)


def test_unauthorized_wallet_cannot_adjudicate(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the assigned authorized insurer may adjudicate"):
        contract.adjudicate_claim("CG-TEST")


def test_claimant_cannot_adjudicate_own_claim(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only the assigned authorized insurer may adjudicate"):
        contract.adjudicate_claim("CG-TEST")


def test_policy_arithmetic_produces_1550000(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    claim = contract.get_claim("CG-TEST")
    assert claim["eligible_loss"] == 1_700_000
    assert claim["maximum_payable"] == 1_550_000
    assert contract.get_maximum_payable("CG-TEST") == 1_550_000


def test_partial_settlement_above_maximum_is_bounded(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation("PARTIAL_APPROVAL", supported_loss=9_000_000))
    claim = contract.get_claim("CG-TEST")
    assert claim["approved_amount"] == 1_550_000
    assert claim["approved_amount"] <= claim["maximum_payable"]


@pytest.mark.parametrize(
    "incident,expected",
    [
        ("2026-08-15", True),
        ("2025-12-31", False),
        ("2027-01-01", False),
        ("2026-01-01", True),
        ("2026-12-31", True),
    ],
    ids=["inside", "before", "after", "start-boundary", "end-boundary"],
)
def test_inclusive_policy_period(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, incident, expected):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob, incident_date=incident)
    assert contract.get_claim("CG-TEST")["policy_active_on_incident_date"] is expected


def test_missing_evidence_manifest_rejected_for_adjudication(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob, manifest_uri="", manifest_hash="")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Usable evidence manifest is required for adjudication"):
        contract.adjudicate_claim("CG-TEST")


def test_evidence_update_after_more_evidence_required(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation("MORE_EVIDENCE_REQUIRED", supported_loss=0))
    assert contract.get_claim("CG-TEST")["finalized"] is False
    direct_vm.sender = direct_alice
    contract.update_evidence("CG-TEST", "https://evidence.example/claims/CG-TEST/manifest-v2.json", MANIFEST_V2_HASH)
    claim = contract.get_claim("CG-TEST")
    assert claim["workflow_status"] == "Evidence Updated"
    assert claim["evidence_revision"] == 2
    assert claim["evidence_changed"] is True
    direct_vm.sender = direct_bob
    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r".*evidence\.example/claims/.*/manifest-v2.*",
        {"status": 200, "body": MANIFEST_V2},
    )
    direct_vm.mock_web(
        r".*evidence\.example/claims/.*/police-report\.txt",
        {"status": 200, "body": TEXT_BYTES},
    )
    direct_vm.mock_llm(PROMPT, json.dumps(evaluation()))
    contract.adjudicate_claim("CG-TEST")
    assert contract.get_claim("CG-TEST")["workflow_status"] == "Approved"


def test_evidence_mutation_after_final_approval_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation())
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence cannot change after final resolution"):
        contract.update_evidence("CG-TEST", "https://evidence.example/new.json", "b" * 64)


def test_duplicate_finalization_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation())
    with direct_vm.expect_revert("Claim is already finalized"):
        contract.adjudicate_claim("CG-TEST")


def test_malformed_leader_output_handled_safely(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    mock_evaluation(direct_vm, {"recommendation": "APPROVE"})
    with direct_vm.expect_revert("[LLM_ERROR]"):
        contract.adjudicate_claim("CG-TEST")


def test_malformed_validator_output_is_non_equivalent(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation())
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*evidence\.example/claims/.*/manifest.*", {"status": 200, "body": MANIFEST})
    direct_vm.mock_web(r".*front-passenger-side-collision-damage\.png", {"status": 200, "body": IMAGE_BYTES})
    direct_vm.mock_llm(PROMPT, json.dumps({"recommendation": "APPROVE"}))
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize(
    "recommendation,status",
    [("REJECT", "Rejected"), ("MORE_EVIDENCE_REQUIRED", "More Evidence Required")],
)
def test_non_approval_outcomes_have_zero_payment(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, recommendation, status):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation(recommendation, supported_loss=500_000))
    claim = contract.get_claim("CG-TEST")
    assert claim["workflow_status"] == status
    assert claim["approved_amount"] == 0


def test_partial_approval_never_exceeds_maximum_payable(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    adjudicate(contract, direct_vm, direct_bob, evaluation("PARTIAL_APPROVAL", supported_loss=1_000_000))
    claim = contract.get_claim("CG-TEST")
    assert claim["workflow_status"] == "Partially Approved"
    assert claim["approved_amount"] == 1_000_000
    assert claim["approved_amount"] <= claim["maximum_payable"]


def test_inactive_policy_cannot_receive_positive_approval(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob, incident_date="2025-12-31")
    direct_vm.sender = direct_bob
    mock_evaluation(direct_vm, evaluation())
    with direct_vm.expect_revert("[LLM_ERROR] approval conflicts with inactive policy period"):
        contract.adjudicate_claim("CG-TEST")


def test_approve_requires_evidence_support_for_documented_loss(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    mock_evaluation(direct_vm, evaluation(supported_loss=500_000))
    with direct_vm.expect_revert("[LLM_ERROR] approval does not support the documented loss"):
        contract.adjudicate_claim("CG-TEST")


def test_manifest_only_metadata_cannot_masquerade_as_inspected_evidence(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    metadata_only = json.dumps({"evidence": []}, sort_keys=True).encode()
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(
        contract,
        direct_vm,
        direct_alice,
        direct_bob,
        manifest_hash=hashlib.sha256(metadata_only).hexdigest(),
    )
    direct_vm.sender = direct_bob
    direct_vm.mock_web(r".*manifest\.json", {"status": 200, "body": metadata_only})
    with direct_vm.expect_revert("manifest metadata cannot replace actual evidence items"):
        contract.adjudicate_claim("CG-TEST")


def test_inaccessible_referenced_evidence_fails_safely(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.mock_web(r".*manifest\.json", {"status": 200, "body": MANIFEST})
    direct_vm.mock_web(r".*front-passenger-side-collision-damage\.png", {"status": 404, "body": b""})
    with direct_vm.expect_revert("evidence item 1 returned HTTP 404"):
        contract.adjudicate_claim("CG-TEST")


def test_referenced_evidence_hash_mismatch_fails_safely(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.mock_web(r".*manifest\.json", {"status": 200, "body": MANIFEST})
    direct_vm.mock_web(
        r".*front-passenger-side-collision-damage\.png",
        {"status": 200, "body": b"different-image-bytes"},
    )
    with direct_vm.expect_revert("evidence item 1 hash mismatch"):
        contract.adjudicate_claim("CG-TEST")


def test_supported_png_bytes_are_passed_to_multimodal_evaluation(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.mock_web(r".*manifest\.json", {"status": 200, "body": MANIFEST})
    direct_vm.mock_web(r".*front-passenger-side-collision-damage\.png", {"status": 200, "body": IMAGE_BYTES})
    observed = {}

    def inspect_llm_request(data):
        observed["images"] = data["images"]
        observed["prompt"] = data["prompt"]
        return {"ok": evaluation()}

    direct_vm._live_llm_handler = inspect_llm_request
    contract.adjudicate_claim("CG-TEST")
    assert observed["images"] == [IMAGE_BYTES]
    assert "verified_multimodal_image" in observed["prompt"]
    assert contract.get_claim("CG-TEST")["workflow_status"] == "Approved"


def test_verified_text_content_not_description_is_supplied_to_evaluator(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_vm, direct_deploy, direct_owner, direct_bob)
    submit(
        contract,
        direct_vm,
        direct_alice,
        direct_bob,
        manifest_uri="https://evidence.example/claims/CG-TEST/manifest-v2.json",
        manifest_hash=MANIFEST_V2_HASH,
    )
    direct_vm.sender = direct_bob
    direct_vm.mock_web(r".*manifest-v2\.json", {"status": 200, "body": MANIFEST_V2})
    direct_vm.mock_web(r".*police-report\.txt", {"status": 200, "body": TEXT_BYTES})
    observed = {}

    def inspect_llm_request(data):
        observed["prompt"] = data["prompt"]
        observed["images"] = data["images"]
        return {"ok": evaluation()}

    direct_vm._live_llm_handler = inspect_llm_request
    contract.adjudicate_claim("CG-TEST")
    assert TEXT_BYTES.decode() in observed["prompt"]
    assert observed["images"] == []


def test_source_uses_real_independent_genlayer_consensus_and_pinned_runner():
    source = Path(CONTRACT).read_text(encoding="utf-8")
    assert source.startswith('# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }')
    assert "gl.nondet.web.get(uri)" in source
    assert "gl.nondet.exec_prompt(" in source
    assert "images=image_payloads" in source
    assert "gl.vm.run_nondet_unsafe(evaluate, validate)" in source
    assert "validator = evaluate()" in source
    assert "py-genlayer:test" not in source
    assert "py-genlayer:latest" not in source
