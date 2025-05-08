const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const SECRET_TOKEN = process.env.GITLAB_SECRET_TOKEN;
const PROJECT_ID = '69686811';

const headers = {
  Authorization: `Bearer ${GITLAB_TOKEN}`
};

// Strip ANSI escape codes
function stripAnsiCodes(text) {
  return text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

// Extract only the step_script portion of the trace
function extractErrorLogSection(trace) {
  const clean = stripAnsiCodes(trace);
  const match = clean.match(/section_start:[\d]+:step_script[\s\S]*?section_end:[\d]+:step_script/);
  return match ? match[0] : clean;
}

// Get latest pipeline
const getLatestPipeline = async () => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/latest`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.id;
};

// Get jobs of a pipeline
const getJobs = async (pipelineId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`;
  const res = await fetch(url, { headers });
  return await res.json();
};

// Get trace log of a job
const getJobTrace = async (jobId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/jobs/${jobId}/trace`;
  const res = await fetch(url, { headers });
  return await res.text(); // plain text
};

// Webhook handler
export default async function handler(req, res) {
  if (req.headers['x-gitlab-token'] !== SECRET_TOKEN) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const event = req.body;

  if (event.object_kind !== 'pipeline') {
    return res.status(200).json({ message: 'Not a pipeline event, ignored' });
  }

  const pipelineStatus = event.object_attributes.status;
  let responsePayload = {
    pipelineStatus,
    failedJob: null
  };

  if (pipelineStatus === 'failed') {
    try {
      const pipelineId = await getLatestPipeline();
      const jobs = await getJobs(pipelineId);

      const failedJob = jobs.find(job => job.status === 'failed');

      if (failedJob) {
        const trace = await getJobTrace(failedJob.id);
        const cleanTrace = extractErrorLogSection(trace);

        responsePayload.failedJob = {
          id: failedJob.id,
          name: failedJob.name,
          trace: cleanTrace
        };
      }
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching job logs', error: err.message });
    }
  }

  return res.status(200).json(responsePayload);
}
