const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const PROJECT_ID = '69686811';
const headers = {
  Authorization: `Bearer ${GITLAB_TOKEN}`
};

// Fetch latest pipeline
const getLatestPipeline = async () => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/latest`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.id;
};

// Fetch jobs of a pipeline
const getJobs = async (pipelineId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data;
};

// Fetch job trace
const getJobTrace = async (jobId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/jobs/${jobId}/trace`;
  const res = await fetch(url, { headers });
  const trace = await res.text(); // not JSON, it's plain text
  return trace;
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const event = req.body;

    if (event.object_kind === 'pipeline') {
      const status = event.object_attributes.status;

      try {
        const pipelineId = await getLatestPipeline();
        const jobs = await getJobs(pipelineId);

        const failedJob = jobs.find(job => job.status === 'failed');
        if (failedJob) {
          const trace = await getJobTrace(failedJob.id);

          return res.status(200).json({
            status: 'failed',
            failedJob: {
              id: failedJob.id,
              name: failedJob.name,
              trace
            }
          });
        } else {
          return res.status(200).json({
            status: 'success',
            message: 'All jobs passed'
          });
        }
      } catch (err) {
        return res.status(500).json({
          status: 'error',
          message: err.message || 'Unexpected error'
        });
      }
    }

    return res.status(200).json({ message: 'Webhook received but not a pipeline event' });
  } else {
    return res.status(405).send('Method not allowed');
  }
}
