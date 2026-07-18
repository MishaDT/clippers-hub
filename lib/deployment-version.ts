type DeploymentEnvironment = {
  VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_DEPLOYMENT_ID?: string;
};

export function resolveDeploymentVersion(environment: DeploymentEnvironment = process.env as DeploymentEnvironment) {
  return (environment.VERCEL_GIT_COMMIT_SHA || environment.VERCEL_DEPLOYMENT_ID || "local").slice(0, 96);
}
