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
    const SECRET_TOKEN = process.env.GITLAB_SECRET_TOKEN; // Add the secret token from your environment variable
  
    // Check if the X-Gitlab-Token matches your secret token
    if (req.headers['x-gitlab-token'] !== SECRET_TOKEN) {
      console.log('❌ Invalid secret token');
      return res.status(403).json({ message: 'Forbidden' });
    }
  
    console.log('📬 Webhook received:', req.body);
  
    if (req.method === 'POST') {
      const event = req.body;
  
      if (event.object_kind === 'pipeline') {
        console.log('📦 Pipeline status:', event.object_attributes.status);
  
        try {
          const pipelineId = await getLatestPipeline();
          const jobs = await getJobs(pipelineId);
  
          const failedJob = jobs.find(job => job.status === 'failed');
          if (failedJob) {
            console.log('🚨 A job failed. Fetching trace logs...');
            const trace = await getJobTrace(failedJob.id);
            console.log('🚨 Error log:', trace);
          } else {
            console.log('✅ All jobs passed');
          }
        } catch (err) {
          console.error('❌ Error fetching data:', err.message);
        }
      }
  
      res.status(200).json({ message: 'Webhook received and processed' });
    } else {
      res.status(405).send('Method not allowed');
    }
  }
  