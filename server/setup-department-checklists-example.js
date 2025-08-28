// Example script to set up department checklists for permit types
// This demonstrates how administrators can configure custom checklists per permit type

const example = {
  "departmentChecklists": {
    "building": [
      {
        "id": "building_plans_complete",
        "label": "Building plans are complete and to scale",
        "required": true,
        "order": 1
      },
      {
        "id": "structural_elements",
        "label": "Structural elements meet building code",
        "required": true,
        "order": 2
      },
      {
        "id": "setback_compliance",
        "label": "Property setbacks comply with zoning",
        "required": true,
        "order": 3
      },
      {
        "id": "foundation_adequate",
        "label": "Foundation design is adequate",
        "required": false,
        "order": 4
      }
    ],
    "fire": [
      {
        "id": "egress_adequate",
        "label": "Emergency egress routes are adequate",
        "required": true,
        "order": 1
      },
      {
        "id": "fire_suppression",
        "label": "Fire suppression system designed properly",
        "required": true,
        "order": 2
      }
    ],
    "planning": [
      {
        "id": "zoning_compliance",
        "label": "Project complies with zoning requirements",
        "required": true,
        "order": 1
      },
      {
        "id": "parking_adequate",
        "label": "Parking spaces meet requirements",
        "required": true,
        "order": 2
      }
    ]
  }
};

console.log('Example API call to set up department checklists:');
console.log('PUT /api/permit-types/{permitTypeId}/department-checklists');
console.log('Body:', JSON.stringify(example, null, 2));
console.log('\nExample API call to get department checklists:');
console.log('GET /api/permit-types/{permitTypeId}/department-checklists');

console.log('\nDifferent permit types can have different checklists:');

const electricalPermitExample = {
  "departmentChecklists": {
    "building": [
      {
        "id": "electrical_plan_review",
        "label": "Electrical plans reviewed and approved",
        "required": true,
        "order": 1
      },
      {
        "id": "panel_capacity",
        "label": "Electrical panel has adequate capacity",
        "required": true,
        "order": 2
      }
    ],
    "fire": [
      {
        "id": "fire_safety_electrical",
        "label": "Electrical work meets fire safety standards",
        "required": true,
        "order": 1
      }
    ]
    // Note: No planning department needed for simple electrical permits
  }
};

console.log('Electrical permit checklist example:');
console.log(JSON.stringify(electricalPermitExample, null, 2));