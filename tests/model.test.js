import MODEL_CONFIG from '../js/config/model-config.js';
import {
  APPROVED_SCENARIOS,
  MODEL_CONFIGURATION_INVALID,
  validateModelConfig,
} from '../js/model/model-config-validator.js';
import {
  assert,
  assertApprox,
  assertDeepEqual,
  assertEqual,
  runRegisteredTests,
  test,
} from './test-utils.js';

const UNIT_BY_PAIR_ID = Object.freeze({
  pass_efficiency: 'epa-per-dropback',
  rush_efficiency: 'epa-per-rush',
  success_rate: 'rate',
  pressure: 'rate',
  explosiveness: 'rate',
  interceptions: 'rate',
  fumbles: 'rate',
});

const APP_CONFIG_FIXTURE = Object.freeze({
  schemaVersion: '1.0.0',
  scenarios: APPROVED_SCENARIOS,
});

const METRIC_CATALOG_FIXTURE = Object.freeze(Object.fromEntries(
  MODEL_CONFIG.metricPairs.flatMap((pair) => [
    [
      pair.offenseMetric,
      Object.freeze({
        id: pair.offenseMetric,
        unit: UNIT_BY_PAIR_ID[pair.id],
        higherIsBetter: MODEL_CONFIG.metricDirections[pair.offenseMetric].higherIsBetter,
      }),
    ],
    [
      pair.defenseMetric,
      Object.freeze({
        id: pair.defenseMetric,
        unit: UNIT_BY_PAIR_ID[pair.id],
        higherIsBetter: MODEL_CONFIG.metricDirections[pair.defenseMetric].higherIsBetter,
      }),
    ],
  ]),
));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(modelConfig = MODEL_CONFIG, overrides = {}) {
  return validateModelConfig({
    modelConfig,
    metricCatalog: overrides.metricCatalog ?? METRIC_CATALOG_FIXTURE,
    appConfig: overrides.appConfig ?? APP_CONFIG_FIXTURE,
  });
}

function assertIssue(result, pathPrefix, rule) {
  assertEqual(result.ok, false, 'Invalid configuration must fail closed.');
  assertEqual(result.code, MODEL_CONFIGURATION_INVALID, 'Stable configuration error code is required.');
  assert(
    result.issues.some(
      (issue) => issue.path.startsWith(pathPrefix) && issue.rule === rule,
    ),
    `Expected ${rule} issue at ${pathPrefix}.`,
  );
}

function isDeeplyFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== 'object' || visited.has(value)) {
    return true;
  }
  visited.add(value);
  return Object.isFrozen(value)
    && Object.values(value).every((nested) => isDeeplyFrozen(nested, visited));
}

test('approved production configuration passes complete validation', () => {
  const result = validate();
  assertEqual(result.ok, true);
  assertEqual(result.config, MODEL_CONFIG, 'Validator must return the same approved object.');
  assertEqual(result.issues.length, 0);
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.issues));
});

test('model configuration is lossless, exact, and deeply frozen', () => {
  assertEqual(MODEL_CONFIG.modelVersion, 'v1-calibrated-20260903');
  assertEqual(MODEL_CONFIG.calibrationReportId, 'MCR-v1-20260903');
  assertEqual(MODEL_CONFIG.certification.productionExportAuthorized, true);
  assertEqual(MODEL_CONFIG.metricPairs.length, 7);
  assertEqual(Object.keys(MODEL_CONFIG.featureStatus).length, 21);
  assertEqual(MODEL_CONFIG.residualDistribution.probabilities.length, 201);
  assertEqual(MODEL_CONFIG.residualDistribution.quantiles.length, 201);
  assertEqual(
    MODEL_CONFIG.residualDistribution.checksumSha256,
    '5130eb5efb8e8ea653b82041a2898297c441dd1fc9f20c1b6174a77881f8bc70',
  );
  assertApprox(MODEL_CONFIG.probabilityCalibration.slope, 0.1205288732344612, 0);
  assert(isDeeplyFrozen(MODEL_CONFIG), 'Every nested configuration value must be frozen.');
});

test('validation is pure and does not mutate supplied inputs', () => {
  const modelConfig = clone(MODEL_CONFIG);
  const metricCatalog = clone(METRIC_CATALOG_FIXTURE);
  const appConfig = clone(APP_CONFIG_FIXTURE);
  const before = JSON.stringify({ modelConfig, metricCatalog, appConfig });
  const result = validateModelConfig({ modelConfig, metricCatalog, appConfig });
  assertEqual(result.ok, true);
  assertEqual(
    JSON.stringify({ modelConfig, metricCatalog, appConfig }),
    before,
    'Validator must not mutate any input.',
  );
});

test('unapproved or nonproduction certification fails closed', () => {
  const pending = clone(MODEL_CONFIG);
  pending.certification.status = 'pending-product-owner-report-approval';
  pending.certification.productionExportAuthorized = false;
  const result = validate(pending);
  assertIssue(result, 'modelConfig.certification.status', 'APPROVAL');
  assertIssue(
    result,
    'modelConfig.certification.productionExportAuthorized',
    'APPROVAL',
  );
});

test('both formally accepted failures and monitoring thresholds are mandatory', () => {
  const missingException = clone(MODEL_CONFIG);
  missingException.certification.acceptedExceptions.pop();
  assertIssue(
    validate(missingException),
    'modelConfig.certification.acceptedExceptions',
    'EXCEPTION_SET',
  );

  const weakenedThreshold = clone(MODEL_CONFIG);
  weakenedThreshold.monitoring.maximumEligibleBinGapThreshold = 0.2;
  assertIssue(
    validate(weakenedThreshold),
    'modelConfig.monitoring.maximumEligibleBinGapThreshold',
    'MONITORING_THRESHOLD',
  );

  const coordinatedWeakening = clone(MODEL_CONFIG);
  coordinatedWeakening.certification.acceptedExceptions[1].threshold = 0.2;
  coordinatedWeakening.monitoring.maximumEligibleBinGapThreshold = 0.2;
  assertIssue(
    validate(coordinatedWeakening),
    'modelConfig.certification.acceptedExceptions[1].threshold',
    'EXCEPTION_THRESHOLD',
  );

  const reducedMonitoringMinimum = clone(MODEL_CONFIG);
  reducedMonitoringMinimum.monitoring.interimMinimumEligibleBinaryGames = 1;
  assertIssue(
    validate(reducedMonitoringMinimum),
    'modelConfig.monitoring.interimMinimumEligibleBinaryGames',
    'MONITORING_MINIMUM',
  );
});

test('catalog identity, direction, and unit mismatches are rejected', () => {
  const missingCatalogMetric = clone(METRIC_CATALOG_FIXTURE);
  delete missingCatalogMetric['offense.pass_epa_per_dropback'];
  assertIssue(
    validate(MODEL_CONFIG, { metricCatalog: missingCatalogMetric }),
    'modelConfig.metricPairs[0].offenseMetric',
    'CATALOG_ID',
  );

  const wrongDirection = clone(METRIC_CATALOG_FIXTURE);
  wrongDirection['offense.pass_epa_per_dropback'].higherIsBetter = false;
  assertIssue(
    validate(MODEL_CONFIG, { metricCatalog: wrongDirection }),
    'modelConfig.metricPairs[0].offenseMetric',
    'DIRECTION_COMPATIBILITY',
  );

  const wrongUnit = clone(METRIC_CATALOG_FIXTURE);
  wrongUnit['defense.pass_epa_allowed_per_dropback'].unit = 'rate';
  assertIssue(
    validate(MODEL_CONFIG, { metricCatalog: wrongUnit }),
    'modelConfig.metricPairs[0]',
    'UNIT_COMPATIBILITY',
  );
});

test('pair IDs, activity, coefficients, and coverage contributions stay coherent', () => {
  const badCoverage = clone(MODEL_CONFIG);
  badCoverage.metricPairs[0].nominalCoverageContribution += 0.01;
  assertIssue(validate(badCoverage), 'modelConfig.metricPairs', 'COVERAGE_SUM');

  const inactiveNonzero = clone(MODEL_CONFIG);
  const fumbles = inactiveNonzero.metricPairs.find((pair) => pair.id === 'fumbles');
  fumbles.coefficient = 0.1;
  assertIssue(
    validate(inactiveNonzero),
    'modelConfig.metricPairs[6]',
    'INACTIVE_ZERO',
  );

  const duplicate = clone(MODEL_CONFIG);
  duplicate.metricPairs[1].id = duplicate.metricPairs[0].id;
  assertIssue(validate(duplicate), 'modelConfig.metricPairs[1].id', 'UNIQUE');

  const missingPair = clone(MODEL_CONFIG);
  missingPair.metricPairs.pop();
  delete missingPair.metricDirections['offense.fumble_rate'];
  delete missingPair.metricDirections['defense.fumble_forced_rate'];
  delete missingPair.shrinkage['offense.fumble_rate'];
  delete missingPair.shrinkage['defense.fumble_forced_rate'];
  delete missingPair.featureStatus['pairFeature.fumbles'];
  assertIssue(validate(missingPair), 'modelConfig.metricPairs', 'PAIR_SET');

  const repairedPair = clone(MODEL_CONFIG);
  repairedPair.metricPairs[0].defenseMetric = 'defense.rush_epa_allowed_per_attempt';
  assertIssue(
    validate(repairedPair),
    'modelConfig.metricPairs[0]',
    'PAIR_DEFINITION',
  );
});

test('probability calibration requires a positive slope and zero intercept', () => {
  const badSlope = clone(MODEL_CONFIG);
  badSlope.probabilityCalibration.slope = 0;
  assertIssue(
    validate(badSlope),
    'modelConfig.probabilityCalibration.slope',
    'VALUE',
  );

  const badIntercept = clone(MODEL_CONFIG);
  badIntercept.probabilityCalibration.intercept = 0.01;
  assertIssue(
    validate(badIntercept),
    'modelConfig.probabilityCalibration.intercept',
    'ZERO_INTERCEPT',
  );
});

test('residual arrays require exact length, order, symmetry, center, and checksum form', () => {
  const wrongLength = clone(MODEL_CONFIG);
  wrongLength.residualDistribution.probabilities.pop();
  assertIssue(
    validate(wrongLength),
    'modelConfig.residualDistribution',
    'RESIDUAL_LENGTH',
  );

  const wrongOrder = clone(MODEL_CONFIG);
  wrongOrder.residualDistribution.probabilities[1]
    = wrongOrder.residualDistribution.probabilities[0];
  assertIssue(
    validate(wrongOrder),
    'modelConfig.residualDistribution.probabilities[1]',
    'STRICT_ORDER',
  );

  const wrongSymmetry = clone(MODEL_CONFIG);
  wrongSymmetry.residualDistribution.quantiles[0] += 1;
  assertIssue(
    validate(wrongSymmetry),
    'modelConfig.residualDistribution.quantiles',
    'RESIDUAL_SYMMETRY',
  );

  const wrongChecksum = clone(MODEL_CONFIG);
  wrongChecksum.residualDistribution.checksumSha256 = 'invalid';
  assertIssue(
    validate(wrongChecksum),
    'modelConfig.residualDistribution.checksumSha256',
    'SHA256',
  );
});

test('situational coefficients and feature status cannot diverge', () => {
  const wrongActivity = clone(MODEL_CONFIG);
  wrongActivity.featureStatus['situational.venue'].active = false;
  assertIssue(
    validate(wrongActivity),
    'modelConfig.featureStatus.situational.venue.active',
    'ACTIVITY_COMPATIBILITY',
  );

  const fixedZeroViolation = clone(MODEL_CONFIG);
  fixedZeroViolation.situational.gameType.wildCard = 0.1;
  assertIssue(
    validate(fixedZeroViolation),
    'modelConfig.featureStatus.situational.roundWC.fixedZero',
    'FIXED_ZERO',
  );
});

test('application schema and the five approved scenarios are enforced', () => {
  const wrongSchema = clone(APP_CONFIG_FIXTURE);
  wrongSchema.schemaVersion = '2.0.0';
  assertIssue(
    validate(MODEL_CONFIG, { appConfig: wrongSchema }),
    'modelConfig.sourceData.schemaVersion',
    'SCHEMA_COMPATIBILITY',
  );

  const wrongScenarioOrder = clone(APP_CONFIG_FIXTURE);
  [wrongScenarioOrder.scenarios[0], wrongScenarioOrder.scenarios[1]] = [
    wrongScenarioOrder.scenarios[1],
    wrongScenarioOrder.scenarios[0],
  ];
  assertIssue(
    validate(MODEL_CONFIG, { appConfig: wrongScenarioOrder }),
    'appConfig.scenarios[0]',
    'SCENARIO_ORDER',
  );
});

test('missing, null, and nonfinite values fail visibly', () => {
  assertIssue(validateModelConfig(), 'modelConfig', 'OBJECT');

  const nullCoefficient = clone(MODEL_CONFIG);
  nullCoefficient.metricPairs[0].coefficient = null;
  assertIssue(
    validate(nullCoefficient),
    'modelConfig.metricPairs[0].coefficient',
    'REQUIRED',
  );

  const infiniteCoefficient = clone(MODEL_CONFIG);
  infiniteCoefficient.metricPairs[0].coefficient = Number.POSITIVE_INFINITY;
  assertIssue(
    validate(infiniteCoefficient),
    'modelConfig.metricPairs[0].coefficient',
    'FINITE_NUMBER',
  );
});

test('accepted configuration keeps every analytical gate exact', () => {
  const activeCoverage = MODEL_CONFIG.metricPairs.reduce(
    (sum, pair) => sum + pair.nominalCoverageContribution,
    0,
  );
  assertApprox(activeCoverage, 1, 1e-12);
  assertEqual(MODEL_CONFIG.coverageThreshold, 0.85);
  assertEqual(MODEL_CONFIG.iterations, 10000);
  assertEqual(MODEL_CONFIG.probabilityCalibration.intercept, 0);
  assertEqual(MODEL_CONFIG.certification.acceptedExceptions.length, 2);
  assertDeepEqual(
    MODEL_CONFIG.certification.acceptedExceptions.map(({ criterion, disposition }) => ({
      criterion,
      disposition,
    })),
    [
      {
        criterion: 'expectedCalibrationError',
        disposition: 'FAIL — FORMALLY ACCEPTED',
      },
      {
        criterion: 'maximumEligibleBinGap',
        disposition: 'FAIL — FORMALLY ACCEPTED',
      },
    ],
  );
});

export async function runModelConfigTests(options) {
  return runRegisteredTests(options);
}

if (typeof window === 'undefined') {
  const summary = await runModelConfigTests();
  if (summary.failed > 0 && typeof process !== 'undefined') {
    process.exitCode = 1;
  }
}
