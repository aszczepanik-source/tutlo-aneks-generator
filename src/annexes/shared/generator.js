/**
 * Builds an immutable rendering plan. It does not calculate dates, amounts or
 * schedules, so moving a module into this structure cannot alter business rules.
 */
export function createGenerationPlanFactory({ annexId, templateUrl, validate }) {
  return function createGenerationPlan(input) {
    const issues = validate(input);
    if (issues.length > 0) {
      return Object.freeze({ ok: false, annexId, issues: Object.freeze(issues) });
    }

    return Object.freeze({
      ok: true,
      annexId,
      templateUrl,
      values: Object.freeze({ ...input })
    });
  };
}
