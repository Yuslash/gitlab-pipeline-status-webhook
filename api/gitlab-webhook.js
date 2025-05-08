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
  console.log('🔍 Fetching latest pipeline...');
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log('✅ Latest pipeline fetched:', data);
  return data.id;
};

// Get jobs of a pipeline
const getJobs = async (pipelineId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`;
  console.log(`🔍 Fetching jobs for pipeline ID: ${pipelineId}...`);
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log('✅ Jobs fetched:', data);
  return data;
};

// Get trace log of a job
const getJobTrace = async (jobId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/jobs/${jobId}/trace`;
  console.log(`🔍 Fetching trace for job ID: ${jobId}...`);
  const res = await fetch(url, { headers });
  const trace = await res.text();
  console.log('✅ Trace fetched');
  return trace;
};

// Webhook handler
export default async function handler(req, res) {
  console.log('📬 Webhook received:', req.body);

  if (req.headers['x-gitlab-token'] !== SECRET_TOKEN) {
    console.log('❌ Invalid secret token');
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const event = req.body;

  if (event.object_kind !== 'pipeline') {
    console.log('ℹ️ Not a pipeline event. Ignored.');
    return res.status(200).json({ message: 'Not a pipeline event, ignored' });
  }

  const pipelineStatus = event.object_attributes.status;
  console.log('📦 Pipeline status:', pipelineStatus);

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
        console.log('🚨 A job failed. Fetching trace logs...');
        const trace = await getJobTrace(failedJob.id);
        const cleanTrace = extractErrorLogSection(trace);
        console.log('🚨 Error log:\n', cleanTrace);

        responsePayload.failedJob = {
          id: failedJob.id,
          name: failedJob.name,
          trace: cleanTrace
        };
      } else {
        console.log('✅ All jobs passed');
      }
    } catch (err) {
      console.error('❌ Error fetching data:', err.message);
      return res.status(500).json({ message: 'Error fetching job logs', error: err.message });
    }
  }

  return res.status(200).json(responsePayload);
}
